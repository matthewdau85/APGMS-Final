#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT}/logs"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${LOG_DIR}/reset-prototype-${RUN_ID}.log"

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

step "[reset] environment"
run "pwd"
run "node -v"
run "pnpm -v"
run "docker --version || true"
run "docker compose version || true"

step "[reset] start dependencies (db + redis)"
# Bring up only what we need. Your docker-compose.yml already exists.
# If you want NATS too, add it here or export WITH_NATS=1.
WITH_NATS="${WITH_NATS:-0}"

if [ "$WITH_NATS" = "1" ] && [ -f "${ROOT}/docker-compose.nats.yml" ]; then
  run "docker compose -f docker-compose.yml -f docker-compose.nats.yml up -d db redis nats || docker compose -f docker-compose.yml -f docker-compose.nats.yml up -d"
else
  run "docker compose -f docker-compose.yml up -d db redis || docker compose -f docker-compose.yml up -d"
fi

step "[reset] wait for postgres"
# Reuse your existing readiness helper if present.
if [ -f "${ROOT}/scripts/readiness/run-db-ready.sh" ]; then
  run "bash scripts/readiness/run-db-ready.sh"
else
  # fallback: pg_isready loop (assumes compose service is db)
  for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
      echo "[ok] postgres ready" | tee -a "$LOG"
      break
    fi
    echo "[wait] postgres ($i/30)" | tee -a "$LOG"
    sleep 1
  done
fi

step "[reset] prisma generate + migrate deploy"
run "pnpm -w exec prisma generate --schema infra/prisma/schema.prisma"
run "pnpm -w exec prisma migrate deploy --schema infra/prisma/schema.prisma"

step "[reset] seed base data (AU tax tables etc)"
# api-gateway seed is already defined in prisma.config.ts as tsx ./db/seed.ts
run "pnpm --filter @apgms/api-gateway db:seed"

step "[reset] seed demo org + case study (deterministic)"
# The demo route lives in api-gateway. We seed via HTTP to create consistent demo state.
API_BASE="${API_BASE:-http://127.0.0.1:3000}"

# If api-gateway isn't running, start it via compose (preferred) or pnpm dev.
# Your repo uses compose-managed api-gateway in readiness chains; attempt start if not already up.
if ! curl -fsS "${API_BASE}/ready" >/dev/null 2>&1; then
  echo "[info] api not ready, trying to start api-gateway via docker compose" | tee -a "$LOG"
  run "docker compose -f docker-compose.yml up -d api-gateway || true"
fi

# If still not ready, try running the service directly (last resort).
if ! curl -fsS "${API_BASE}/ready" >/dev/null 2>&1; then
  echo "[info] api not ready, starting via pnpm dev (background)" | tee -a "$LOG"
  # Start in background, return immediately
  (cd "$ROOT/services/api-gateway" && pnpm dev >/dev/null 2>&1 &) || true
  for i in $(seq 1 40); do
    if curl -fsS "${API_BASE}/ready" >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
fi

curl -fsS "${API_BASE}/ready" >/dev/null 2>&1 || die "api-gateway not reachable at ${API_BASE}"

# Choose defaults; adjust if your demo route expects different fields.
DEMO_ORG_ID="${DEMO_ORG_ID:-org-demo-001}"
DEMO_CASE_ID="${DEMO_CASE_ID:-CAFE_MONTHLY}"
DEMO_SEED="${DEMO_SEED:-apgms-demo-seed-001}"

run "curl -fsS -X POST ${API_BASE}/demo/seed -H 'content-type: application/json' -d '{\"orgId\":\"${DEMO_ORG_ID}\",\"caseId\":\"${DEMO_CASE_ID}\",\"seed\":\"${DEMO_SEED}\"}' | cat"

step "[reset] scoped redis flush (safe)"
# Do NOT FLUSHALL. Only delete APGMS keys if you have a known prefix.
# If you do not have a prefix yet, skip this step.
REDIS_PREFIX="${REDIS_PREFIX:-apgms:}"
if docker compose exec -T redis redis-cli PING >/dev/null 2>&1; then
  echo "[info] redis reachable" | tee -a "$LOG"
  # delete keys by prefix if any exist (safe even if none)
  run "docker compose exec -T redis redis-cli --scan --pattern '${REDIS_PREFIX}*' | head -n 500 | xargs -r docker compose exec -T redis redis-cli DEL >/dev/null || true"
else
  echo "[warn] redis not reachable; skipping redis cleanup" | tee -a "$LOG"
fi

step "[reset] done"
echo "[OK] reset completed. log: ${LOG}"
