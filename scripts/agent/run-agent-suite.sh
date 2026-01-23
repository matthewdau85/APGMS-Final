#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_DIR="${ROOT_DIR}/logs/agent-suite"
LOG_FILE="${LOG_DIR}/agent-suite-${RUN_ID}.log"

mkdir -p "${LOG_DIR}"

run() {
  echo ">>> $*" | tee -a "${LOG_FILE}"
  (cd "${ROOT_DIR}" && "$@") 2>&1 | tee -a "${LOG_FILE}"
}

echo "============================================================" | tee "${LOG_FILE}"
echo "APGMS Agent Suite" | tee -a "${LOG_FILE}"
echo "run_id: ${RUN_ID}" | tee -a "${LOG_FILE}"
echo "root: ${ROOT_DIR}" | tee -a "${LOG_FILE}"
echo "log: ${LOG_FILE}" | tee -a "${LOG_FILE}"
echo "============================================================" | tee -a "${LOG_FILE}"

run git rev-parse --short HEAD
run node -v
run pnpm -v

run pnpm install --frozen-lockfile
run pnpm typecheck

if pnpm -s run | grep -qE '^test\b'; then
  run pnpm test
else
  echo ">>> pnpm test not found; skipping" | tee -a "${LOG_FILE}"
fi

if pnpm -s run | grep -qE '^readiness:all\b'; then
  run pnpm readiness:all
else
  echo ">>> pnpm readiness:all not found; skipping" | tee -a "${LOG_FILE}"
fi

if pnpm -s run | grep -qE '^compliance:evidence\b'; then
  run pnpm compliance:evidence
else
  echo ">>> pnpm compliance:evidence not found; skipping" | tee -a "${LOG_FILE}"
fi

if pnpm -s run | grep -qE '^backup:evidence-pack\b'; then
  run pnpm backup:evidence-pack
else
  echo ">>> pnpm backup:evidence-pack not found; skipping" | tee -a "${LOG_FILE}"
fi

echo "============================================================" | tee -a "${LOG_FILE}"
echo "DONE: agent suite completed successfully" | tee -a "${LOG_FILE}"
echo "============================================================" | tee -a "${LOG_FILE}"
