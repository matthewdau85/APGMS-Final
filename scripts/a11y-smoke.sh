#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5173}"
HOST="127.0.0.1"
PORT="5173"

kill_port_listener() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti "tcp:${port}" || true)"
    if [[ -n "${pids}" ]]; then
      echo "Killing processes on port ${port}: ${pids}"
      # shellcheck disable=SC2086
      kill ${pids} || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" || true
  fi
}

echo "▶ A11y smoke: Playwright + Vite (${BASE_URL})"

pnpm exec playwright install --with-deps

# Ensure the port is free (prevents your local “Port 5173 already in use” failure)
kill_port_listener "${PORT}"

pnpm --dir webapp dev -- --host "${HOST}" --port "${PORT}" --strictPort &
VITE_PID=$!

cleanup() {
  kill "${VITE_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

pnpm dlx wait-on "${BASE_URL}"
pnpm -w exec playwright test webapp/tests/a11y.spec.ts
echo "✅ A11y smoke passed"
