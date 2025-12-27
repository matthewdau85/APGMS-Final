#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5173}"

echo "▶ A11y smoke: Playwright + Vite (${BASE_URL})"

# Ensure playwright browsers are available (installs OS deps on Linux runners)
pnpm exec playwright install --with-deps

# Free the port if something is already running (common locally)
PORT="$(echo "$BASE_URL" | sed -E 's|.*:([0-9]+).*|\1|')"
PIDS="$(lsof -ti tcp:${PORT} || true)"
if [[ -n "${PIDS}" ]]; then
  echo "Killing processes on port ${PORT}: ${PIDS}"
  kill ${PIDS} || true
fi

# Start Vite
pnpm --dir webapp dev -- --host 127.0.0.1 --port "${PORT}" --strictPort &
VITE_PID=$!

cleanup() {
  kill "${VITE_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

pnpm dlx wait-on "${BASE_URL}"

BASE_URL="${BASE_URL}" pnpm -w exec playwright test webapp/tests/a11y.spec.ts

echo "✅ A11y smoke passed"
