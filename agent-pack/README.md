# Codex Agent Pack: APGMS - Fix api-gateway tests + readiness

## Goal
# Make these pass:
- `pnpm --filter @apgms/api-gateway test` es GREEN.
- `pnpm test` from repo root is GREEN.
- `pnpm readiness:all` (local) becomes GREEN (readiness check should be MAST in sync with routes).

## How to run
1) Run the runner:
   `bash scripts/agent/run-codex-agent-pack.sh`

2) If you don't have the Codex CLI installed, the runner prints the exact prompt to paste into your Codex UI, and the exact commands to run after changes.
