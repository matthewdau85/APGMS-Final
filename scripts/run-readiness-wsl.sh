#!/usr/bin/env bash
set -euo pipefail

# If this file was saved with CRLF, fix it and re-run cleanly.
if grep -q $'\r' "$0"; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="${READINESS_LOG_PATH:-$ROOT_DIR/logs}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/readiness-run-$RUN_ID.log"

# Tee all output to a log file.
exec > >(tee -a "$LOG_FILE") 2>&1

echo "============================================================"
echo "APGMS WSL Readiness Runner"
echo "============================================================"
echo "[root] $ROOT_DIR"
echo "[run_id] $RUN_ID"
echo "[log] $LOG_FILE"
echo

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing required tool: $1" >&2; exit 2; }; }

port_in_use() {
  local port="$1"
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":${port}$"
}

wait_http_200() {
  local url="$1"
  local timeout_s="$2"
  local start
  start="$(date +%s)"
  while true; do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    local now
    now="$(date +%s)"
    if (( now - start >= timeout_s )); then
      return 1
    fi
    sleep 1
  done
}

echo "[versions]"
node -v || true
pnpm -v || true
corepack --version || true
echo

need node
need pnpm
need curl
need ss

# Optional: install deps (off by default)
INSTALL="${INSTALL:-0}"
if [[ "$INSTALL" == "1" ]]; then
  echo "[deps] pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  echo
fi

# Config
READY_URL="${READY_URL:-http://127.0.0.1:3000/ready}"
API_PORT="${API_PORT:-3000}"

WEB_PORT="${WEB_PORT:-5173}"
E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"

RUN_K6="${RUN_K6:-1}"
RUN_E2E_SMOKE="${RUN_E2E_SMOKE:-1}"
RUN_READINESS="${RUN_READINESS:-1}"

KEEP_SERVERS="${KEEP_SERVERS:-0}"

api_started=0
web_started=0
api_pid=""
web_pid=""

cleanup() {
  if [[ "$KEEP_SERVERS" == "1" ]]; then
    echo "[cleanup] KEEP_SERVERS=1; leaving any started servers running."
    return 0
  fi

  if [[ "$web_started" == "1" && -n "${web_pid}" ]]; then
    echo "[cleanup] stopping webapp (pid $web_pid)"
    kill "$web_pid" >/dev/null 2>&1 || true
  fi

  if [[ "$api_started" == "1" && -n "${api_pid}" ]]; then
    echo "[cleanup] stopping api-gateway (pid $api_pid)"
    kill "$api_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "============================================================"
echo "1) Ensure API readiness on ${READY_URL}"
echo "============================================================"

if curl -fsS --max-time 2 "$READY_URL" >/dev/null 2>&1; then
  echo "[api] /ready OK (already running)"
else
  if port_in_use "$API_PORT"; then
    echo "[api] Port ${API_PORT} is in use, but ${READY_URL} is not returning 200."
    echo "[api] Refusing to start a second server. Investigate the listener:"
    echo "  ss -ltnp | grep \":${API_PORT}\" || true"
    echo "  curl -i ${READY_URL} || true"
    exit 2
  fi

  echo "[api] starting @apgms/api-gateway dev (logs: $LOG_DIR/api-gateway-$RUN_ID.log)"
  (pnpm --filter @apgms/api-gateway dev) >"$LOG_DIR/api-gateway-$RUN_ID.log" 2>&1 &
  api_pid="$!"
  api_started=1

  if ! wait_http_200 "$READY_URL" 90; then
    echo "[api] ERROR: /ready did not become 200 within 90s."
    echo "[api] last logs:"
    tail -n 80 "$LOG_DIR/api-gateway-$RUN_ID.log" || true
    exit 2
  fi

  echo "[api] /ready OK"
fi
echo

echo "============================================================"
echo "2) Ensure webapp is reachable on ${E2E_BASE_URL}"
echo "============================================================"

if curl -fsS --max-time 2 "${E2E_BASE_URL}/" >/dev/null 2>&1; then
  echo "[web] webapp OK (already running)"
else
  if port_in_use "$WEB_PORT"; then
    echo "[web] Port ${WEB_PORT} is in use, but ${E2E_BASE_URL} is not reachable."
    echo "[web] Refusing to start a second server. Investigate the listener:"
    echo "  ss -ltnp | grep \":${WEB_PORT}\" || true"
    echo "  curl -i ${E2E_BASE_URL}/ || true"
    exit 2
  fi

  echo "[web] starting apgms-webapp dev with strict port (logs: $LOG_DIR/webapp-$RUN_ID.log)"
  (pnpm --filter apgms-webapp dev -- --host 127.0.0.1 --port "${WEB_PORT}" --strictPort) >"$LOG_DIR/webapp-$RUN_ID.log" 2>&1 &
  web_pid="$!"
  web_started=1

  if ! wait_http_200 "${E2E_BASE_URL}/" 90; then
    echo "[web] ERROR: webapp did not become reachable within 90s."
    echo "[web] last logs:"
    tail -n 120 "$LOG_DIR/webapp-$RUN_ID.log" || true
    exit 2
  fi

  echo "[web] webapp OK"
fi
echo

echo "============================================================"
echo "3) (Optional) Run k6 smoke with real --summary-export"
echo "============================================================"

if [[ "$RUN_K6" == "1" ]]; then
  if command -v k6 >/dev/null 2>&1 && [[ -f "$ROOT_DIR/k6/smoke.js" ]]; then
    echo "[k6] running smoke and writing standard summary export to k6/smoke-summary.json"
    k6 run \
      --summary-export "$ROOT_DIR/k6/smoke-summary.json" \
      -e BASE_URL="http://127.0.0.1:${API_PORT}" \
      "$ROOT_DIR/k6/smoke.js"
  else
    echo "[k6] SKIP: k6 not installed or k6/smoke.js not found."
    echo "[k6] Install k6 or set RUN_K6=0."
  fi
else
  echo "[k6] SKIP (RUN_K6=0)"
fi
echo

echo "============================================================"
echo "4) (Optional) Run Playwright @smoke (no webServer)"
echo "============================================================"

if [[ "$RUN_E2E_SMOKE" == "1" ]]; then
  echo "[e2e] Running smoke with PW_NO_WEBSERVER=1 (we already started the webapp)"
  echo "[e2e] If the test fails, traces are under: webapp/test-results/**/trace.zip"
  PW_NO_WEBSERVER=1 E2E_BASE_URL="$E2E_BASE_URL" \
    pnpm --dir webapp exec playwright test \
    --project=chromium --grep @smoke --workers=1 --reporter=line --trace=retain-on-failure
else
  echo "[e2e] SKIP (RUN_E2E_SMOKE=0)"
fi
echo

echo "============================================================"
echo "5) (Optional) Run readiness:all with all pillars enabled"
echo "============================================================"

if [[ "$RUN_READINESS" == "1" ]]; then
  READINESS_WITH_E2E=1 \
  READINESS_WITH_LOG_SCAN=1 \
  READINESS_WITH_INCIDENT=1 \
  READINESS_LOG_PATH="$LOG_DIR" \
    pnpm readiness:all
else
  echo "[readiness] SKIP (RUN_READINESS=0)"
fi
echo

echo "============================================================"
echo "DONE"
echo "Log saved: $LOG_FILE"
echo "============================================================"
