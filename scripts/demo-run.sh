#!/usr/bin/env bash
set -euo pipefail

log() { printf "\n=== %s ===\n" "$*"; }

have() { command -v "$1" >/dev/null 2>&1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE_DEFAULT="${ROOT_DIR}/docker-compose.yml"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_FILE_DEFAULT}"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-3000}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-5173}"

PIDS=()

cleanup() {
  log "Cleanup"
  for pid in "${PIDS[@]:-}"; do
    kill "${pid}" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT INT TERM

kill_port_listener() {
  local port="$1"

  # Kill host processes (WSL)
  if have lsof; then
    local pids
    pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "Killing processes on port ${port}: ${pids}"
      # shellcheck disable=SC2086
      kill ${pids} >/dev/null 2>&1 || true
    fi
  elif have fuser; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi

  # Stop any docker container that is publishing this port
  if have docker; then
    docker ps --format '{{.Names}} {{.Ports}}' \
      | grep -F -- "->${port}/tcp" \
      | awk '{print $1}' \
      | xargs -r docker stop >/dev/null 2>&1 || true
  fi
}

wait_for_tcp() {
  local host="$1"
  local port="$2"
  node "${ROOT_DIR}/scripts/wait-for-tcp.mjs" "${host}" "${port}" "30000"
}

log "APGMS demo run (WSL)"
echo "Repo: ${ROOT_DIR}"

log "Check toolchain"
node -v
pnpm -v
docker --version

log "Install deps"
pnpm -w install --frozen-lockfile

log "Free ports for local dev"
kill_port_listener "${API_PORT}"
kill_port_listener "${WEB_PORT}"

log "Start DB + Redis + Tax Engine (docker compose)"
echo "Compose: ${COMPOSE_FILE}"
docker compose -f "${COMPOSE_FILE}" up -d db redis tax-engine

log "Wait for DB TCP"
wait_for_tcp "127.0.0.1" "5432"
echo "OK: TCP 127.0.0.1:5432"

log "Prisma generate + migrate"
pnpm -w prisma:generate
pnpm -w prisma:migrate

log "Start API gateway (local)"
pnpm --filter @apgms/api-gateway dev &
PIDS+=("$!")
# Wait for readiness
for _ in {1..40}; do
  if curl -fsS "http://${API_HOST}:${API_PORT}/health/ready" >/dev/null 2>&1; then
    echo "OK: API /health/ready is responding at http://${API_HOST}:${API_PORT}/health/ready"
    break
  fi
  sleep 0.25
done

log "Start webapp"
pnpm --dir webapp dev -- --host 0.0.0.0 --port "${WEB_PORT}" &
PIDS+=("$!")
for _ in {1..80}; do
  if curl -fsS "http://${WEB_HOST}:${WEB_PORT}/" >/dev/null 2>&1; then
    echo "OK: Webapp is responding at http://${WEB_HOST}:${WEB_PORT}/"
    break
  fi
  sleep 0.25
done

log "Demo URLs"
echo "Webapp (Windows browser): http://localhost:${WEB_PORT}"
echo "API (Windows/WSL):       http://localhost:${API_PORT}"
echo
echo "Try:"
echo "  curl -sS \"http://${API_HOST}:${API_PORT}/prototype/overview?period=2025-Q1\" -b cookies.txt | cat"
echo
echo "Press Ctrl+C to stop."

# Keep foreground alive
wait
