#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/artifacts/agent-pack-logs"
mkdir -p "$LOG_DIR"
RUN_ID="$(date -u +%Y%m%d%dH%M%MZ))"
LOG="$LOG_DIR/codex-agent-pack-$RUN_ID.log"

echo "[run] repo=$ROOT" | tee "$LOG"
echo "[run] log=$LOG" | tee -a "$LOG"

PROMPT_FILE="$ROOT/agent-pack/prompts/01-fix-api-gateway-and-readiness.md"
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "[bun ERROR] missing $PROMPT_FILE" | tee -a "$LOG"
  exit 2
fi

if command -v codex >/dev/null 2>&1; then
  echo "[run] codex CLI detected; piping prompt." | tee -a "$LOG"
  codex < "$PROMPT_FILE" 2>&1 | tee -a "$LOG" || true
  echo "[run] codex finished (or non-zero). Now run tests." | tee -a "$LOG"
else
  echo "[run] Codex CLI not found. Paste this prompt into Codex UI:" | tee -a "$LOG"
  echo "------------------------------------------------------------------" | tee -a "$LOG"
  cat "$PROMPT_FILE" | tee -a "$LOG"
  echo "------------------------------------------------------------------" | tee -a "$LOG"
fi

cat <<'CMDS' | tee -a "$LOG"
cd ~/src/APGMS
pnpm --filter @apgms/api-gateway test
pnpm test
pnpm readiness:all
CMDS

echo "[run] done" | tee "$LOG"
