#!/usr/bin/env bash
# scripts/local-ci.sh
#
# One-terminal local CI runner for APGMS.
# - Logs everything to logs/local-ci/local-ci-<UTC>.log
# - Avoids interactive Corepack download prompts
# - Starts Docker Compose (optional) and waits for /ready
# - Runs the repo's chained checks + readiness in a single pass
#
# Usage:
#   bash scripts/local-ci.sh
#
# Useful env knobs:
#   PNPM_VERSION=9.15.9          # desired pnpm version (default 9.15.9)
#   COREPACK_TIMEOUT=180         # seconds for corepack prepare (default 180)
#   INSTALL_FROZEN=1             # 1=try --frozen-lockfile first (default 1)
#   AUTO_UNFROZEN_ON_MISMATCH=1  # 1=retry with --no-frozen-lockfile on mismatch (default 1)
#   WITH_DOCKER=1                # 1=run docker compose up (default 1)
#   READY_URL=http://localhost:3000/ready
#   READY_TIMEOUT=240            # seconds to wait for READY_URL (default 240)
#   READINESS_RUN_K6=1           # 1=run k6 inside readiness (default 1)
#   WITH_SECURITY=0              # 1=run gitleaks/trivy/sbom/sca/validate:ato (default 0)
#   DOWN_AFTER=0                 # 1=docker compose down at end (default 0)
#   LOG_DIR=./logs/local-ci      # override log directory
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NOW="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_DIR="${LOG_DIR:-$ROOT/logs/local-ci}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/local-ci-$NOW.log"

# Non-interactive behaviour.
export CI=1
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COMPOSE_PROGRESS=plain
export PNPM_DISABLE_SELF_UPDATE_CHECK=1
export PNPM_CONFIG_REPORTER=append-only

# Stream output to console + log.
if command -v stdbuf >/dev/null 2>&1; then
  exec > >(stdbuf -oL -eL tee -a "$LOG_FILE") 2>&1
else
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

step() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

die() {
  echo "[ERROR] $*" >&2
  echo "[ERROR] Log file: $LOG_FILE" >&2
  exit 2
}

have() { command -v "$1" >/dev/null 2>&1; }

timeout_run() {
  # timeout_run <seconds> <cmd...>
  local secs="$1"; shift
  if have timeout; then
    timeout "$secs" "$@"
  else
    "$@"
  fi
}

on_fail() {
  local code=$?
  echo
  echo "[FAIL] Exit code: $code"
  echo "[FAIL] Log file: $LOG_FILE"
  echo
  echo "----- last 200 log lines -----"
  tail -n 200 "$LOG_FILE" || true
  echo "------------------------------"
  exit "$code"
}
trap on_fail ERR

step "Environment / Versions"
echo "[pwd] $ROOT"
echo "[time_utc] $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[git] $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "n/a") $(git rev-parse --short HEAD 2>/dev/null || echo "")"
echo "[node] $(node -v 2>/dev/null || echo "n/a")"
echo "[corepack] $(corepack --version 2>/dev/null || echo "n/a")"
echo "[pnpm_path] $(command -v pnpm 2>/dev/null || echo "n/a")"
echo "[pnpm] $(pnpm -v 2>/dev/null || echo "n/a")"
echo "[docker] $(docker --version 2>/dev/null || echo "n/a")"
echo "[compose] $(docker compose version 2>/dev/null || echo "n/a")"
echo "[packageManager] $(node -p "try{require('./package.json').packageManager||''}catch(e){''}" 2>/dev/null || true)"

step "Ensure pnpm is usable (no prompts)"
PNPM_VERSION="${PNPM_VERSION:-9.15.9}"
COREPACK_TIMEOUT="${COREPACK_TIMEOUT:-180}"

# Prefer user-local shims to avoid /usr/bin permission issues.
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"

# Enable corepack shims in user dir (best-effort, bounded).
if have corepack; then
  echo "[corepack] enabling shims in $HOME/.local/bin (best-effort)"
  timeout_run 30 corepack enable --install-directory "$HOME/.local/bin" >/dev/null 2>&1 || true
fi

# If pnpm version isn't what we want, attempt to prepare it (bounded).
CURRENT_PNPM="$(pnpm -v 2>/dev/null || echo "")"
if [ "$CURRENT_PNPM" != "$PNPM_VERSION" ] && have corepack; then
  echo "[corepack] preparing pnpm@$PNPM_VERSION (timeout ${COREPACK_TIMEOUT}s)"
  timeout_run "$COREPACK_TIMEOUT" corepack prepare "pnpm@$PNPM_VERSION" --activate || {
    echo "[WARN] corepack prepare did not complete. Continuing with current pnpm: ${CURRENT_PNPM:-n/a}"
  }
fi

echo "[pnpm_path] $(command -v pnpm 2>/dev/null || echo "n/a")"
echo "[pnpm] $(pnpm -v 2>/dev/null || echo "n/a")"

# Guard: if pnpm is still missing, stop early.
have pnpm || die "pnpm not found. Ensure Node.js includes corepack, or install pnpm in user space."

step "Install dependencies"
INSTALL_FROZEN="${INSTALL_FROZEN:-1}"
AUTO_UNFROZEN_ON_MISMATCH="${AUTO_UNFROZEN_ON_MISMATCH:-1}"

install_ok=0
if [ "$INSTALL_FROZEN" = "1" ]; then
  echo "[pnpm] install --frozen-lockfile"
  set +e
  pnpm -s install --frozen-lockfile
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then
    install_ok=1
  else
    echo "[WARN] pnpm frozen install failed (exit $rc)."
    if [ "$AUTO_UNFROZEN_ON_MISMATCH" = "1" ]; then
      echo "[pnpm] retrying install --no-frozen-lockfile"
      pnpm -s install --no-frozen-lockfile
      install_ok=1
      echo "[WARN] Lockfile may have been updated. Commit pnpm-lock.yaml to restore frozen installs."
    else
      die "pnpm install --frozen-lockfile failed. Re-run with INSTALL_FROZEN=0 or fix pnpm-lock.yaml."
    fi
  fi
else
  echo "[pnpm] install --no-frozen-lockfile"
  pnpm -s install --no-frozen-lockfile
  install_ok=1
fi

[ "$install_ok" = "1" ] || die "Dependency install did not complete."

step "Start dependencies (Docker Compose) and wait for /ready"
WITH_DOCKER="${WITH_DOCKER:-1}"
READY_URL="${READY_URL:-http://localhost:3000/ready}"
READY_TIMEOUT="${READY_TIMEOUT:-240}"

wait_for_url() {
  local url="$1"
  local seconds="$2"
  local start
  start="$(date +%s)"
  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[ready] OK: $url"
      return 0
    fi
    now="$(date +%s)"
    if [ $((now - start)) -ge "$seconds" ]; then
      echo "[ready] TIMEOUT after ${seconds}s: $url"
      return 1
    fi
    echo "[ready] waiting for $url ..."
    sleep 3
  done
}

if [ "$WITH_DOCKER" = "1" ]; then
  if have docker; then
    echo "[docker] docker compose up -d (COMPOSE_PROGRESS=plain)"
    # docker compose can look "frozen" in TTY mode; plain progress prints continuously in logs.
    set +e
    timeout_run 240 docker compose up -d
    dc_rc=$?
    set -e
    if [ "$dc_rc" -ne 0 ]; then
      echo "[WARN] docker compose up -d returned $dc_rc."
      docker compose ps || true
      docker compose logs --no-color --tail 80 || true
    fi
  else
    echo "[WARN] docker not found; skipping docker compose."
  fi
else
  echo "[docker] skipped (WITH_DOCKER=0)"
fi

wait_for_url "$READY_URL" "$READY_TIMEOUT" || {
  echo "[WARN] $READY_URL not ready. Showing compose status/logs for diagnostics."
  docker compose ps || true
  docker compose logs --no-color --tail 120 || true
  die "API gateway did not become ready at $READY_URL"
}

step "Chain: static checks + readiness (single command)"
# This should be your "one command" run once services are up.
# It typically runs: typecheck/lint/test/build (via scripts/run-all-tests.sh) and then readiness chain.
READINESS_RUN_K6="${READINESS_RUN_K6:-1}"
export READINESS_RUN_K6
export READINESS_LOG_PATH="$LOG_DIR"

pnpm -s readiness:chain

step "Optional: security + compliance scans"
WITH_SECURITY="${WITH_SECURITY:-0}"
if [ "$WITH_SECURITY" = "1" ]; then
  pnpm -s gitleaks
  pnpm -s trivy
  pnpm -s sbom
  pnpm -s sca
  pnpm -s validate:ato
else
  echo "[skip] WITH_SECURITY=0"
fi

step "Playwright report (if generated)"
REPORT_DIR="$ROOT/webapp/playwright-report"
if [ -d "$REPORT_DIR" ]; then
  echo "[playwright] Report directory: $REPORT_DIR"
  echo "[playwright] View with:"
  echo "  pnpm exec playwright show-report \"$REPORT_DIR\""
else
  echo "[playwright] No report directory found at $REPORT_DIR"
fi

step "DONE"
echo "Log file: $LOG_FILE"

DOWN_AFTER="${DOWN_AFTER:-0}"
if [ "$DOWN_AFTER" = "1" ]; then
  step "Stopping Docker Compose (DOWN_AFTER=1)"
  docker compose down
fi
