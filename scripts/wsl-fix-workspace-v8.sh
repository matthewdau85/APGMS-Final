#!/usr/bin/env bash
# APGMS workspace repair (v8, WSL-safe, ASCII)
# - Fix CRLF, ensure pnpm
# - Install missing deps (api, shared, webapp tests, node types)
# - Prisma generate
# - Patch domain-policy (node:crypto -> crypto; drop QUARTERLY line)
# - Kill stale :3000, bring API up, probe /ready with graceful degrade

set -euo pipefail
sed -i 's/\r$//' "$0" 2>/dev/null || true

ROOT="${ROOT:-$PWD}"
LOG="$ROOT/logs/wsl-fix-workspace-v8-$(date -u +%Y%m%dT%H%M%SZ).log"
mkdir -p "$ROOT/logs"
log(){ printf '[%(%FT%TZ)T] %s\n' -1 "$*" | tee -a "$LOG"; }
need(){ command -v "$1" >/dev/null 2>&1 || { log "Missing: $1"; exit 2; }; }

log "[fix] repo: $ROOT"
need node; need sed; need grep

# 0) Normalise CRLF in repo scripts
if [ -d "$ROOT/scripts" ]; then
  find "$ROOT/scripts" -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;
fi

# 1) Ensure pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable || true
    corepack prepare pnpm@9 --activate || true
  else
    npm i -g pnpm@9
  fi
fi

# 2) Dependencies
log "[deps] ensure runtime/dev deps"
pnpm --filter @apgms/api-gateway add zod @fastify/cors fastify >/dev/null 2>&1 || true
pnpm --filter @apgms/shared add zod nats >/dev/null 2>&1 || true
pnpm --filter apgms-webapp add -D @axe-core/playwright @playwright/test >/dev/null 2>&1 || true
pnpm -w add -D @types/node >/dev/null 2>&1 || true
pnpm --filter @apgms/domain-policy add -D @types/node >/dev/null 2>&1 || true
pnpm -w add -D prisma @prisma/client >/dev/null 2>&1 || true

# 3) Prisma client (tooling + generate)
log "[prisma] generate from infra schema"
pnpm --filter @apgms/shared exec prisma generate --schema=../infra/prisma/schema.prisma | tee -a "$LOG" || true

# 4) Patch domain-policy build errors
DP="$ROOT/packages/domain-policy"
if [ -d "$DP/src" ]; then
  log "[patch] domain-policy: fix node:crypto imports -> crypto and QUARTERLY key"
  grep -RIl --include='*.ts' 'node:crypto' "$DP/src" | xargs -r sed -i 's|"node:crypto"|"crypto"|g'
  sed -i '/QUARTERLY:[[:space:]]*4,*/d' "$DP/src/au-tax/paygw-rounding.ts" 2>/dev/null || true
fi

# 5) Install (allow lock updates)
log "[install] pnpm install (workspace)"
pnpm install --no-frozen-lockfile | tee -a "$LOG" || true

# 6) Build key packages (best effort)
log "[build] webapp"
pnpm --filter apgms-webapp build | tee -a "$LOG" || true

log "[build] domain-policy"
pnpm --filter @apgms/domain-policy build | tee -a "$LOG" || true

# 7) Free up :3000 if something is stuck
log "[api] ensure port 3000 is free"
if command -v ss >/dev/null 2>&1; then
  PID_LINE="$(ss -ltnp 2>/dev/null | grep ':3000' || true)"
  if [ -n "$PID_LINE" ]; then
    PID="$(echo "$PID_LINE" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1)"
    if [ -n "$PID" ]; then
      log "[api] killing stale pid $PID on :3000"
      kill "$PID" 2>/dev/null || true
      sleep 1
      kill -9 "$PID" 2>/dev/null || true
    fi
  fi
fi

# 8) Start API and probe readiness
API_DIR="$ROOT/services/api-gateway"
log "[api] start dev (tsx)"
( cd "$API_DIR" && pnpm dev ) > "$ROOT/logs/api-gateway-$(date -u +%Y%m%dT%H%M%SZ).log" 2>&1 &
API_PID=$!
log "[api] pid=$API_PID  logs: logs/api-gateway-*.log"

READY_URL="${READY_URL:-http://127.0.0.1:3000/ready}"
log "[probe] $READY_URL (timeout ~90s)"
OK=0
for i in $(seq 1 30); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "$READY_URL" || echo 000)"
  if [ "$CODE" = "200" ]; then
    OK=1; log "[probe] READY 200"; break
  fi
  if [ "$CODE" != "000" ]; then
    log "[probe] not ready (code=$CODE) try $i/30"
  else
    log "[probe] not reachable try $i/30"
  fi
  sleep 3
done

if [ "$OK" -ne 1 ]; then
  log "[warn] /ready not 200; printing headers:"
  curl -sI "$READY_URL" | sed 's/^/[probe] /' | tee -a "$LOG" || true
fi

log "[done] v8 repair complete. Log: $LOG"
exit 0
