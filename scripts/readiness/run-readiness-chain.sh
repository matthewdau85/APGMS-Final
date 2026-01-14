#!/usr/bin/env bash
set -euo pipefail

CHAIN_MANAGE_COMPOSE="${CHAIN_MANAGE_COMPOSE:-1}"
DOCKER_COMPOSE_CMD="${DOCKER_COMPOSE_CMD:-docker compose}"
COMPOSE_CMD=()
read -r -a COMPOSE_CMD <<<"$DOCKER_COMPOSE_CMD"
COMPOSE_GATEWAY="api-gateway"
READY_URL="${READY_URL:-http://localhost:3000/ready}"
READY_TIMEOUT="${READY_TIMEOUT:-60}"
READY_DELAY="${READY_DELAY:-1}"

# Staged readiness chain runner
# Logs: artifacts/readiness-logs/<timestamp>/<stage>.log
# Stages: sbom -> gitleaks -> trivy -> validate_ato -> test_a11y -> run_all

usage() {
  cat <<'USAGE'
Usage:
  scripts/readiness/run-readiness-chain.sh [--list] [--from <stage>] [--help]

Stages:
  sbom
  gitleaks
  trivy
  validate_ato
  test_a11y
  run_all

Examples:
  pnpm readiness:chain
  pnpm readiness:chain -- --from trivy
  pnpm readiness:chain -- --list

Notes:
  - CHAIN_MANAGE_COMPOSE controls whether the script manages docker compose api-gateway (default: 1).
  - If CHAIN_MANAGE_COMPOSE=0, port 3000 must be free and api-gateway must already be running.
  - This runner prints PASS/FAIL/SKIP per stage and records logs under artifacts/readiness-logs/<ts>.
  - CRLF detection guards scripts/readiness/*.sh.
USAGE
}

have() { command -v "$1" >/dev/null 2>&1; }

die() {
  echo "ERROR: $*" >&2
  exit 1
}

banner() {
  printf "\n============================================================\n"
  printf "%s\n" "$1"
  printf "============================================================\n"
}

check_crlf() {
  local fail=0
  local file
  for file in scripts/readiness/*.sh; do
    [ -f "${file}" ] || continue
    if LC_ALL=C grep -q $'\r' "${file}"; then
      echo "CRLF detected in ${file}; run: sed -i 's/\\r$//' ${file}"
      fail=1
    fi
  done
  [ "${fail}" -eq 0 ]
}

have_docker() {
  have "${COMPOSE_CMD[0]:-}"
}

compose_cmd() {
  "${COMPOSE_CMD[@]}" "$@"
}

compose_is_running() {
  local service="$1"
  if ! have_docker; then
    return 1
  fi
  if compose_cmd ps --filter status=running --services >/dev/null 2>&1; then
    compose_cmd ps --filter status=running --services | grep -Fxq "${service}"
  else
    # fallback: inspect all services and look for running state
    compose_cmd ps --format '{{.Service}} {{.State}}' | awk '$2 == "running" {print $1}' | grep -Fxq "${service}"
  fi
}

compose_start() {
  local service="$1"
  if ! have_docker; then
    die "docker is required to manage ${service}"
  fi
  compose_cmd up -d "${service}" >/dev/null
}

is_port_3000_bound() {
  if have ss; then
    if ss -ltn 'sport = :3000' 2>/dev/null | grep -q LISTEN; then
      return 0
    fi
  fi
  if have lsof; then
    if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

describe_port_3000_conflict() {
  if have ss; then
    ss -lptn 'sport = :3000' 2>/dev/null || true
  elif have lsof; then
    lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true
  else
    echo "port 3000 status unavailable (ss/lsof missing)"
  fi
}

wait_ready() {
  local url="$1"
  local attempts="$2"
  local delay="$3"
  WAIT_READY_LAST_STATUS=""
  WAIT_READY_LAST_ERROR=""
  WAIT_READY_LAST_BODY=""

  for ((i = 1; i <= attempts; i++)); do
    local body_file
    local err_file
    body_file="$(mktemp)"
    err_file="$(mktemp)"
    local status
    status="$(curl -s -S -o "${body_file}" -w "%{http_code}" "${url}" 2>"${err_file}" || true)"
    local rc=$?
    WAIT_READY_LAST_STATUS="${status}"
    WAIT_READY_LAST_ERROR="$(cat "${err_file}" 2>/dev/null || true)"
    WAIT_READY_LAST_BODY="$(cat "${body_file}" 2>/dev/null || true)"
    rm -f "${body_file}" "${err_file}"

    if [ "${rc}" -eq 0 ] && [ "${status}" = "200" ]; then
      return 0
    fi

    if [ "${rc}" -ne 0 ]; then
      echo "[chain] curl failed (attempt ${i}/${attempts}): ${WAIT_READY_LAST_ERROR:-<no output>}"
    else
      echo "[chain] /ready status ${status} (attempt ${i}/${attempts}) - retrying..."
    fi
    sleep "${delay}"
  done

  return 1
}

log_readiness_diagnostics() {
  local log_file="$1"
  echo
  echo "=== readiness diagnostics ==="
  echo "api-gateway (docker compose) running: $(compose_is_running "${COMPOSE_GATEWAY}" && echo "yes" || echo "no")"
  echo "port 3000 bound: $(is_port_3000_bound && echo "yes" || echo "no")"
  if [ -n "${log_file}" ] && [ -f "${log_file}" ]; then
    echo "last /ready lines:"
    grep -E "/ready" "${log_file}" | tail -n 5 || true
  fi
  echo "============================="
  echo
}

ensure_api_gateway_ready() {
  if [ "${CHAIN_MANAGE_COMPOSE}" != "1" ]; then
    return
  fi

  if ! compose_is_running "${COMPOSE_GATEWAY}"; then
    echo "Starting ${COMPOSE_GATEWAY} via ${DOCKER_COMPOSE_CMD}..."
    compose_start "${COMPOSE_GATEWAY}" || die "failed to start ${COMPOSE_GATEWAY}"
  fi

  if wait_ready "${READY_URL}" "${READY_TIMEOUT}" "${READY_DELAY}"; then
    echo "api-gateway readiness probe succeeded"
    return 0
  fi

  describe_port_3000_conflict
  log_readiness_diagnostics /dev/null
  die "api-gateway readiness never reported 200"
}

# Port conflict handling: fail only when compose isn't managing it.
handle_port_conflict() {
  if is_port_3000_bound; then
    if [ "${CHAIN_MANAGE_COMPOSE}" -eq 1 ] && compose_is_running "${COMPOSE_GATEWAY}"; then
      echo "Port 3000 in use and ${COMPOSE_GATEWAY} is running – assuming expected."
    else
      echo "Port 3000 is already in use; please stop the listener before rerunning readiness."
      describe_port_3000_conflict
      exit 2
    fi
  fi
}

repo_root() {
  if have git; then
    local r
    r="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [ -n "${r}" ] && [ -d "${r}" ]; then
      echo "${r}"
      return 0
    fi
  fi

  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "$(cd "${here}/../.." && pwd)"
}

find_run_all_script() {
  local root="$1"
  local candidates=(
    "${root}/scripts/run-all-tests.sh"
    "${root}/run-all-tests.sh"
    "${root}/scripts/readiness/run-all-tests.sh"
  )

  local p
  for p in "${candidates[@]}"; do
    if [ -f "${p}" ]; then
      echo "${p}"
      return 0
    fi
  done

  p="$(find "${root}" -maxdepth 4 -type f -name 'run-all-tests.sh' 2>/dev/null | head -n 1 || true)"
  if [ -n "${p}" ]; then
    echo "${p}"
    return 0
  fi

  return 1
}

run_stage() {
  local stage="$1"
  local cmd="$2"
  local log="$3"

  banner "STAGE: ${stage}"
  echo "Command: ${cmd}"
  echo "Log: ${log}"
  echo

  mkdir -p "$(dirname "${log}")"

  set +e
  bash -lc "${cmd}" 2>&1 | tee "${log}"
  local rc="${PIPESTATUS[0]}"
  set -e

  return "${rc}"
}

STAGES=(sbom gitleaks trivy validate_ato test_a11y run_all)

FROM_STAGE=""
DO_LIST="0"

while [ $# -gt 0 ]; do
  case "$1" in
    --)
      shift
      ;;
    --from)
      shift
      [ $# -gt 0 ] || die "--from requires a stage name"
      FROM_STAGE="$1"
      shift
      ;;
    --list)
      DO_LIST="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1 (use --help)"
      ;;
  esac
done

[ "${DO_LIST}" = "1" ] && { printf "%s\n" "${STAGES[@]}"; exit 0; }

ROOT="$(repo_root)"
cd "${ROOT}"

if ! check_crlf; then
  die "Fix CRLF in scripts/readiness/*.sh before running the chain."
fi

TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="${ROOT}/artifacts/readiness-logs/${TS}"
mkdir -p "${LOG_DIR}"

RUN_ALL_PATH=""
if RUN_ALL_PATH="$(find_run_all_script "${ROOT}")"; then
  :
else
  die "Could not locate run-all-tests.sh in repo (expected scripts/run-all-tests.sh or similar)."
fi

declare -A CMDS
CMDS[sbom]="pnpm run sbom"
CMDS[gitleaks]="pnpm run gitleaks"
CMDS[trivy]="pnpm run trivy"
CMDS[validate_ato]="pnpm validate:ato"
CMDS[test_a11y]="pnpm run test:a11y"
CMDS[run_all]="bash \"${RUN_ALL_PATH}\""

declare -A STATUS
for s in "${STAGES[@]}"; do STATUS["$s"]="SKIP"; done

if [ -n "${FROM_STAGE}" ]; then
  found="0"
  for s in "${STAGES[@]}"; do
    if [ "${s}" = "${FROM_STAGE}" ]; then found="1"; break; fi
  done
  [ "${found}" = "1" ] || die "Unknown --from stage: ${FROM_STAGE} (use --list)"
fi

banner "READINESS CHAIN START"
echo "Repo: ${ROOT}"
echo "Logs: ${LOG_DIR}"
echo "Run-all: ${RUN_ALL_PATH}"
if [ -n "${FROM_STAGE}" ]; then
  echo "Resume from: ${FROM_STAGE}"
fi

handle_port_conflict

started="0"
failed="0"
failed_stage=""
failed_rc="0"

for s in "${STAGES[@]}"; do
  if [ -n "${FROM_STAGE}" ] && [ "${started}" = "0" ]; then
    if [ "${s}" = "${FROM_STAGE}" ]; then
      started="1"
    else
      STATUS["${s}"]="SKIP"
      continue
    fi
  else
    started="1"
  fi

  if [ "${s}" = "run_all" ]; then
    ensure_api_gateway_ready
  fi

  log="${LOG_DIR}/${s}.log"
  cmd="${CMDS[${s}]}"

  if run_stage "${s}" "${cmd}" "${log}"; then
    STATUS["${s}"]="PASS"
  else
    rc="$?"
    if [ "${s}" = "test_a11y" ] && grep -q "No projects matched the filters" "${log}"; then
      STATUS["${s}"]="SKIP"
      continue
    fi
    if [ "${s}" = "run_all" ] && grep -q "/ready" "${log}"; then
      log_readiness_diagnostics "${log}"
    fi
    STATUS["${s}"]="FAIL"
    failed="1"
    failed_stage="${s}"
    failed_rc="${rc}"
    break
  fi
done

banner "READINESS CHAIN SUMMARY"
echo "Logs directory: ${LOG_DIR}"
echo

for s in "${STAGES[@]}"; do
  printf "%-12s  %-4s  %s\n" "${s}" "${STATUS[${s}]}" "${LOG_DIR}/${s}.log"
done

echo
if [ "${failed}" = "1" ]; then
  echo "FAILED at stage: ${failed_stage} (exit ${failed_rc})"
  exit "${failed_rc}"
fi

echo "ALL STAGES PASSED"
exit 0
