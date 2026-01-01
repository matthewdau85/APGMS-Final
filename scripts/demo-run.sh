#!/usr/bin/env bash
set -euo pipefail

log() { printf "\n=== %s ===\n" "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

kill_port_listener() {
  local port="$1"

  # Stop any docker container publishing this port (covers cases outside compose too)
  docker ps --format '{{.ID}} {{.Ports}}' | grep -E -- "[:]{port}->" >/dev/null 2>&1 && \
    docker ps --format '{{.ID}} {{.Ports}}' | grep -E -- "[:]{port}->" | awk '{print $1}' | xargs -r docker stop || true

  # Kill any WSL process listening on this port
  if have lsof; then
    local pids
    pids="$(lsof -ti "tcp:${port}" || true)"
    if [[ -n "${pids}" ]]; then
      echo "Killing processes on port ${port}: ${pids}"
      kill ${pids} >/dev/null 2>&1 || true
    fi
  elif have fuser; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
}

wait_for_tcp() {
  local host="$1"
  local port="$2"
  local label="${3:-TCP ${host}:${port}}"
  local i

  for i in {1..60}; do
    if (echo >/dev/tcp/"${host}"/"${port}") >/dev/null 2>&1; then
      echo "OK: ${label}"
      return 0
    fi
    sleep 1
  done

  echo "ERROR: timeout waiting for ${label}" >&2
  return 1
}

wait_for_http() {
  local url="$1"
  local label="${2:-${url}}"
  local i

  for i in {1..60}; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "OK: ${label}"
      return 0
    fi
    sleep 1
  done

  echo "ERROR: timeout waiting for HTTP ${label}" >&2
  return 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-5173}"

log "APGMS demo run (WSL)"
echo "Repo: ${ROOT_DIR}"

log "Check toolchain"
node -v
pnpm -v
docker --version

log "Install deps"
pnpm i --frozen-lockfile

log "Free ports for local dev"
kill_port_listener "${API_PORT}"
kill_port_listener "${WEB_PORT}"

log "Start DB + Redis + Tax Engine (docker compose)"
echo "Compose: ${ROOT_DIR}/${COMPOSE_FILE}"

# Ensure docker compose is NOT running api-gateway/worker (they publish 3000)
"${COMPOSE[@]}" stop api-gateway worker >/dev/null 2>&1 || true

# Start only infra services needed for local dev
"${COMPOSE[@]}" up -d db redis tax-engine

log "Wait for DB TCP"
wait_for_tcp "127.0.0.1" "5432" "Postgres TCP 127.0.0.1:5432"

log "Prisma generate + migrate"
pnpm prisma:generate
pnpm prisma:migrate

log "Start API gateway (local)"
HOST="0.0.0.0" PORT="${API_PORT}" pnpm --dir services/api-gateway dev &
API_PID=$!

cleanup() {
  log "Cleanup"
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_http "http://127.0.0.1:${API_PORT}/health/ready" "API /health/ready is responding"

log "Start webapp"
pnpm --dir webapp dev -- --host 0.0.0.0 --port "${WEB_PORT}" &
WEB_PID=$!

trap 'kill "${WEB_PID}" >/dev/null 2>&1 || true; cleanup' EXIT

wait_for_http "http://127.0.0.1:${WEB_PORT}/" "Webapp is responding"

log "Demo URLs"
echo "Webapp (Windows browser): http://localhost:${WEB_PORT}"
echo "API (Windows/WSL):       http://localhost:${API_PORT}"
echo ""
echo "Try:"
echo "  curl -sS \"http://127.0.0.1:${API_PORT}/regulator/compliance/summary?period=2025-Q1\" -H \"x-org-id: org_1\" | cat"
echo "  curl -sS \"http://127.0.0.1:${API_PORT}/compliance/summary?period=2025-Q1\" | cat"
echo ""
echo "Press Ctrl+C to stop."
wait
