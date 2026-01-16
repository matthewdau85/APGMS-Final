#!/usr/bin/env bash
# APGMS: run dev stack (API strict + webapp)
# - Ensures DB is up & migrated
# - Starts API in strict mode and probes /ready
# - Launches Vite webapp on :5173

# Be forgiving if 'pipefail' unsupported
set -Eeuo pipefail 2>/dev/null || set -Eeuo

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://apgms:apgms@localhost:5432/apgms?schema=public}"

log(){ printf '[%(%FT%TZ)T] %s\n' -1 "$*"; }

cleanup() {
  log "[stop] stopping API (if running)"
  ( fuser -k 3000/tcp 2>/dev/null || true
    lsof -ti :3000 -sTCP:LISTEN -Fp 2>/dev/null | sed 's/^p//' | xargs -r kill -9 || true
    pkill -f "services/api-gateway.*tsx" 2>/dev/null || true
    pkill -f "node.*services/api-gateway" 2>/dev/null || true ) || true
}
trap cleanup EXIT INT TERM

log "[start] dev stack"

# 1) Make sure port 3000 is free
"$ROOT/scripts/dev-api-stop.sh" || true

# 2) Bring API up in strict (DB-backed) mode
"$ROOT/scripts/dev-api-strict-v4.sh"

# 3) Smoke test API
"$ROOT/scripts/dev-api-smoke.sh" >/dev/null

# 4) Start webapp in foreground (Ctrl+C stops webapp, trap stops API)
cd "$ROOT/webapp"
exec pnpm dev -- --host 0.0.0.0 --port 5173 --strictPort
