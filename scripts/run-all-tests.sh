#!/bin/bash

set -euo pipefail

LOG_DIR="artifacts/runlogs"
mkdir -p "$LOG_DIR"

run_and_log() {
  local label=$1
  shift
  local log_file="$LOG_DIR/${label}.log"
  echo "=== Running ${label} ==="
  {
    printf "\n=== %s (%s) ===\n" "$(date --iso-8601=seconds)" "$label"
    "$@"
  } | tee "$log_file"
}

export PNPM_RECURSIVE_OUTPUT="append"

run_and_log "api-gateway-tests" pnpm --filter @apgms/api-gateway test
run_and_log "domain-policy-tests" pnpm --filter @apgms/domain-policy test
run_and_log "bas-validator" pnpm --filter @apgms/api-gateway test -- bas.validation.test.ts --runInBand

run_and_log "all-tests" pnpm -r test
run_and_log "build-all" pnpm -r build
run_and_log "typecheck-all" pnpm -r typecheck

run_and_log "gitleaks" pnpm run gitleaks
run_and_log "trivy" pnpm run trivy
run_and_log "sbom" pnpm run sbom
run_and_log "sca" pnpm run sca
run_and_log "a11y-smoke" pnpm test:a11y

run_and_log "validate-ato" pnpm validate:ato
run_and_log "readiness" pnpm readiness:all

run_and_log "generate-docs" ./scripts/generate-docs.sh
run_and_log "validate-docs" ./scripts/validate-docs.sh

echo "All commands completed. Logs are in $LOG_DIR."
