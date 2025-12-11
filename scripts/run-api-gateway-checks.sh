#!/usr/bin/env bash
set -euo pipefail

cd /mnt/c/src/apgms

LOG_DIR="./logs"
mkdir -p "$LOG_DIR"

TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
LOG_FILE="$LOG_DIR/api-gateway-checks-$TIMESTAMP.log"

{
  echo "=== $(date) ==="
  echo "Running: pnpm -r typecheck"
  pnpm -r typecheck

  echo
  echo "Running: pnpm --filter @apgms/api-gateway test"
  pnpm --filter @apgms/api-gateway test

  echo
  echo "Status: SUCCESS"
} 2>&1 | tee "$LOG_FILE"
