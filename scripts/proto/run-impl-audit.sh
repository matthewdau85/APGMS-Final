#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="$ROOT/logs/proto-audit"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/proto-audit-$RUN_ID.log"

exec > >(tee -a "$LOG") 2>&1

echo "============================================================"
echo "APGMS Prototype Implementation Audit"
echo "============================================================"
echo "[run_id] $RUN_ID"
echo "[root] $ROOT"
echo

echo "[versions]"
node -v
pnpm -v || true
docker -v || true
docker compose version || true
echo

echo "============================================================"
echo "1) Start stack (compose)"
echo "============================================================"
# Adjust if your compose file path differs.
docker compose up -d --build

echo
echo "============================================================"
echo "2) Wait for API readiness"
echo "============================================================"
API_BASE="http://127.0.0.1:3000"
for i in $(seq 1 60); do
  if curl -fsS "$API_BASE/ready" >/dev/null 2>&1; then
    echo "[OK] /ready is responding"
    break
  fi
  echo "[wait] /ready not up yet ($i/60)"
  sleep 1
done

echo
echo "============================================================"
echo "3) Live endpoint smoke"
echo "============================================================"
echo "--- GET /ready"
curl -sS -D - "$API_BASE/ready" | head -c 2000 || true
echo
echo "--- GET /health/ready"
curl -sS -D - "$API_BASE/health/ready" | head -c 2000 || true
echo
echo "--- GET /metrics"
curl -sS -D - "$API_BASE/metrics" | head -c 2000 || true
echo
echo "--- GET /version"
curl -sS -D - "$API_BASE/version" | head -c 2000 || true
echo

echo "============================================================"
echo "4) Repo scan (routes + UI paths)"
echo "============================================================"
node scripts/proto/audit-impl.mjs

echo
echo "============================================================"
echo "5) Regwatcher run-once (if present)"
echo "============================================================"
if [ -d "packages/regwatcher" ]; then
  pnpm -s --filter @apgms/regwatcher run once || true
  tail -n 20 packages/regwatcher/data/changes.ndjson || true
else
  echo "[skip] packages/regwatcher not found"
fi

echo
echo "[OK] audit complete"
echo "[log] $LOG"
echo "[out] artifacts/proto-audit/impl-audit.json"
echo "[out] artifacts/proto-audit/impl-audit.md"
