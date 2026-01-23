#!/usr/bin/env bash
# Prototype full test runner (single terminal, fully logged)

# Require bash (not sh/dash)
if [ -z "${BASH_VERSION:-}" ]; then
  echo "ERROR: This script requires bash. Run it with: bash scripts/test-prototype-all.sh" >&2
  exit 2
fi

set -eu
# Enable pipefail only if supported by this shell
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

run_id="$(date -u +%Y%m%dT%H%M%SZ)"
out_dir="$ROOT/logs/prototype-test/$run_id"
mkdir -p "$out_dir"
log="$out_dir/run.log"

run() {
  echo ">>> $*" | tee -a "$log"
  "$@" 2>&1 | tee -a "$log"
}

echo "[run_id] $run_id" | tee -a "$log"
run git rev-parse --short HEAD
run node -v
run pnpm -v

# Dependencies
run pnpm install --frozen-lockfile

# Minimal infra for tests that touch DB/cache (brings up db + redis only)
if command -v docker >/dev/null 2>&1; then
  run docker compose up -d db redis
fi

# Core quality gates
run pnpm typecheck
run pnpm test

# Optional webapp suites (keep enabled if they exist in your root package.json)
run pnpm e2e
run pnpm test:a11y

# Pillar-style assessor reports (prototype posture)
run mkdir -p assessment/reports
run node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --fast --outdir assessment/reports
run node assessment/assessor-10of10-v3/scripts/apgms-assess.cjs --all --outdir assessment/reports

echo
echo "DONE"
echo "Log: $log"
echo "Assessor outputs: $ROOT/assessment/reports"
