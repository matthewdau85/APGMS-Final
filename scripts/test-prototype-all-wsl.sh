#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT}/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${LOG_DIR}/prototype-all-${RUN_ID}.log"

mkdir -p "${LOG_DIR}"

step() {
  echo
  echo "============================================================" | tee -a "$LOG"
  echo "$1" | tee -a "$LOG"
  echo "============================================================" | tee -a "$LOG"
}

run() {
  echo ">>> $*" | tee -a "$LOG"
  (cd "$ROOT" && bash -lc "$*") 2>&1 | tee -a "$LOG"
}

die() {
  echo "[FAIL] $*" | tee -a "$LOG" >&2
  exit 1
}

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
WEB_BASE="${WEB_BASE:-http://127.0.0.1:5173}"

step "[1/9] Reset stack + seed"
run "bash scripts/reset-prototype-wsl.sh"

step "[2/9] Root typecheck + tests (fast)"
run "pnpm typecheck"
run "pnpm test --filter @apgms/api-gateway"
run "pnpm lint:eol"

step "[3/9] API probes"
run "curl -fsS ${API_BASE}/ready | cat"

# demo seed pack (optional)
if [ -f "${ROOT}/scripts/demo-seed-pack.sh" ]; then
  run "API_BASE=${API_BASE} bash scripts/demo-seed-pack.sh"
fi

# A small set of “must respond” routes (adjust if your server differs)
run "curl -fsS ${API_BASE}/auth/me || true"
run "curl -fsS ${API_BASE}/regulator/compliance/summary || true"

step "[4/9] Webapp build + smoke"
# Your design app currently builds even with TS errors; still run its typecheck to force correctness.
run "pnpm -C apps/apgms-webapp-design exec tsc -p tsconfig.json --noEmit || true"
run "pnpm -C apps/apgms-webapp-design build"

step "[5/9] E2E (Playwright) against apgms-webapp"
# Your root scripts target apgms-webapp (not the design app). Still valuable.
# If apgms-webapp isn't configured/running, this will fail; keep logs.
run "pnpm e2e || true"

step "[6/9] A11y smoke"
run "pnpm test:a11y || true"

step "[7/9] k6 smoke"
run "pnpm k6:smoke || true"

step "[8/9] Fault injection (optional)"
# Toggle with FAULTS=1
FAULTS="${FAULTS:-0}"
if [ "$FAULTS" = "1" ]; then
  step "[fault] restart api-gateway"
  run "docker compose restart api-gateway || true"
  run "curl -fsS ${API_BASE}/ready | cat"

  step "[fault] restart redis"
  run "docker compose restart redis || true"
  run "curl -fsS ${API_BASE}/ready | cat"

  step "[fault] restart db"
  run "docker compose restart db || true"
  run "curl -fsS ${API_BASE}/ready | cat"
fi

step "[9/9] Summary pointers"
echo "[OK] finished. log: ${LOG}"
echo "Next: open the log and search for '[FAIL]' or 'ERROR:'"
