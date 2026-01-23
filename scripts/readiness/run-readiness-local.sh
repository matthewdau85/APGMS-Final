#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export READINESS_LOG_PATH="$PWD/artifacts/readiness-logs/$RUN_ID"
mkdir -p "$READINESS_LOG_PATH"

READY_URL="${READINESS_READY_URL:-http://127.0.0.1:3000/ready}"

log() {
  echo "$*" | tee -a "$READINESS_LOG_PATH/run.log"
}

pids_on_3000() {
  ss -ltnp 2>/dev/null | grep -E ":3000\\b" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u
}

port_free() {
  ! ss -ltnp 2>/dev/null | grep -qE ":3000\\b"
}

ready_ok() {
  curl -fsS --max-time 2 "$READY_URL" >/dev/null 2>&1
}

kill_3000_listeners() {
  local pids
  pids="$(pids_on_3000 || true)"
  if [[ -z "${pids:-}" ]]; then
    return 0
  fi

  log "[run] killing port 3000 listeners: $pids"
  for pid in $pids; do
    kill -TERM "$pid" 2>/dev/null || true
  done

  # Wait briefly, then SIGKILL any survivors
  for _ in $(seq 1 5); do
    if port_free; then
      return 0
    fi
    sleep 1
  done

  pids="$(pids_on_3000 || true)"
  if [[ -n "${pids:-}" ]]; then
    log "[run] forcing kill (SIGKILL) for: $pids"
    for pid in $pids; do
      kill -KILL "$pid" 2>/dev/null || true
    done
  fi

  # Final wait
  for _ in $(seq 1 5); do
    if port_free; then
      return 0
    fi
    sleep 1
  done

  log "[run] ERROR: port 3000 is still in use after kill attempts"
  ss -ltnp | grep -E ":3000\\b" | tee -a "$READINESS_LOG_PATH/run.log" || true
  return 1
}

start_api_gateway_best_effort() {
  local pkg="services/api-gateway/package.json"
  if [[ ! -f "$pkg" ]]; then
    log "[run] WARN: $pkg not found; cannot auto-start api-gateway."
    return 0
  fi

  local script
  script="$(node -e '
    const fs=require("fs");
    const j=JSON.parse(fs.readFileSync("services/api-gateway/package.json","utf8"));
    const s=j.scripts||{};
    const candidates=["dev","start:dev","start","serve"];
    const found=candidates.find(k=>typeof s[k]==="string");
    process.stdout.write(found||"");
  ')"

  if [[ -z "$script" ]]; then
    log "[run] WARN: no dev/start scripts found in services/api-gateway/package.json"
    return 0
  fi

  log "[run] starting api-gateway via: pnpm --filter @apgms/api-gateway $script"
  (pnpm --filter @apgms/api-gateway "$script" >"$READINESS_LOG_PATH/api-gateway.log" 2>&1) &
  echo $! >"$READINESS_LOG_PATH/api-gateway.pid"
}

log "[run] READY_URL=$READY_URL"
log "[run] READINESS_LOG_PATH=$READINESS_LOG_PATH"

if ready_ok; then
  log "[run] /ready already OK"
else
  kill_3000_listeners || true
  start_api_gateway_best_effort

  log "[run] waiting up to 60s for /ready..."
  for _ in $(seq 1 60); do
    if ready_ok; then
      log "[run] /ready OK"
      break
    fi
    sleep 1
  done
fi

pnpm readiness:all
