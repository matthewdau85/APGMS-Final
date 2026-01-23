#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FORCE=0
PATENT_PATH=""
EXPORT_PATH=""

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/agent/setup-codex-agent-pack.sh [--force] [--patent /abs/path/to/Patent.docx] [--export /abs/path/to/combined-code-export.txt]

Creates:
  agent-pack/ (prompts + runbook)
  scripts/agent/run-codex-agent-pack.sh
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    --patent) PATENT_PATH="${2:-}"; shift 2 ;;
    --export) EXPORT_PATH="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

PACK_DIR="$ROOT/agent-pack"
PROMPTS_DIR="$PACK_DIR/prompts"
ASSETS_DIR="$PACK_DIR/assets"

if [[ -d "$PACK_DIR" && "$FORCE" -ne 1 ]]; then
  echo "[setup] $PACK_DIR already exists. Re-run with --force to overwrite." >&2
  exit 2
fi

rm -rf "$PACK_DIR"
mkdir -p "$PROMPTS_DIR" "$ASSETS_DIR" "$ROOT/artifacts/agent-pack-logs"

# Optional assets
if [[ -n "$PATENT_PATH" && -f "$PATENT_PATH" ]]; then
  cp -f "$PATENT_PATH" "$ASSETS_DIR/Patent.docx"
  echo "[setup] Copied patent -> $ASSETS_DIR/Patent.docx"
fi
if [[ -n "$EXPORT_PATH" && -f "$EXPORT_PATH" ]]; then
  cp -f "$EXPORT_PATH" "$ASSETS_DIR/combined-code-export.txt"
  echo "[setup] Copied export -> $ASSETS_DIR/combined-code-export.txt"
fi

cat > "$PACK_DIR/README.md" <<'MD'
# Codex Agent Pack: APGMS - Fix api-gateway tests + readiness

## Goal
Make these pass:
- `pnpm --filter @apgms/api-gateway test`
- `pnpm test` (repo)
- `pnpm readiness:all` (readiness should be GREEN)

## How to run
1) Generate pack (already done):
   - `bash scripts/agent/setup-codex-agent-pack.sh --force`

2) Run the agent:
   - `bash scripts/agent/run-codex-agent-pack.sh`

If you do not have the Codex CLI installed, the runner will print the exact prompt to paste into your Codex UI (VS Code / web) and the exact commands to run after Codex applies changes.
MD

cat > "$PROMPTS_DIR/01-fix-api-gateway-and-readiness.md" <<'MD'
You are working in the APGMS repository.

Primary acceptance criteria (must all pass):
1) `pnpm --filter @apgms/api-gateway test` is GREEN.
2) `pnpm test` from repo root is GREEN.
3) `pnpm readiness:all` is GREEN locally.
4) Do NOT do broad refactors. Minimal surgical changes only. ASCII only. Keep existing conventions.

Observed failures you must eliminate (from current Jest output):
- Many routes return 404 and must exist with correct behavior:
  - GET `/health` -> 200 `{ ok: true }`
  - GET `/health/live` -> 200 `{ ok: true }`
  - GET `/health/ready`:
      - 200 `{ ok: true, checks: { db: true } }` when DB reachable
      - 503 `{ ok: false, checks: { db: false } }` when DB unreachable (test-controlled)
  - GET `/metrics` must return Prometheus text that includes:
      - `process_cpu_user_seconds_total`
      - `apgms_http_requests_total`
      - `apgms_db_query_duration_seconds`

- Readiness currently checks `/ready` and gets 404. Fix via one of:
  - Implement GET `/ready` (alias to ready check), OR
  - Update readiness check logic to use `/health/ready`.
  Prefer adding `/ready` route for compatibility.

- Settlements route suite is failing as 404:
  - POST `/api/settlements/bas` must exist.
  - When Authorization header missing -> 401 (not 404).
  - When authorized + valid payload -> 201 with JSON containing `instructionId` and expected fields.
  - Idempotency:
      - Duplicate Idempotency-Key with identical payload -> replay same 201 + same body.
      - Reuse same Idempotency-Key with different payload -> 409.

- Prototype routes failing:
  - `/monitor/risk/summary` behavior:
      - In production: always 404 (even for admin).
      - In non-production:
          - non-admin -> 403 `{ error: "admin_only_prototype" }`
          - admin -> 200 (any simple JSON body ok, but must not be 404).

- Regulator compliance summary e2e failing because `(app as any).db` is undefined in tests:
  - Ensure buildFastifyApp (or whatever factory tests use) attaches `app.db` when `inMemoryDb: true`.
  - Provide in-memory models used by the test:
      - `db.payrollItem.create({ data: ... })`
      - `db.gstTransaction.create({ data: ... })`
  - `/regulator/compliance/summary` must produce HIGH risk when ledger is empty but seeded obligations exist (as per test expectations).

- CORS allowlist production tests failing:
  - In production, if allowlist is empty -> buildFastifyApp should throw matching `/CORS_ALLOWED_ORIGINS/`.
  - In production, if Origin not allowlisted -> respond 403 `{ error: "cors_origin_forbidden" }`.
  - In production, if Origin allowlisted -> allow and set `Access-Control-Allow-Origin` to origin.
  - Ensure OPTIONS preflight also respects allowlist (tests show 204 currently).

Implementation guidance:
- Identify the app factory used by tests (likely `buildFastifyApp`) and ensure it registers all routes/plugins used in tests.
- Prefer a single “compat routes” plugin that registers the missing endpoints and reuses existing internal services if present.
- Keep behavior deterministic and test-friendly. Expose a test-only knob for DB reachability (e.g., `configOverrides.dbReachable` or similar) matching existing patterns in the repo.
- Do not break existing routes; just make tests pass.

After changes:
- Run:
  - `pnpm --filter @apgms/api-gateway test`
  - `pnpm test`
  - `pnpm readiness:all`
- If readiness requires an API running, make sure it can self-start or document one command that starts api-gateway and makes `/ready` respond.

Deliverables:
- Commit-ready code changes only. No commentary. Keep diffs minimal.
MD

cat > "$ROOT/scripts/agent/run-codex-agent-pack.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/artifacts/agent-pack-logs"
mkdir -p "$LOG_DIR"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$LOG_DIR/codex-agent-pack-$RUN_ID.log"

echo "[run] repo=$ROOT" | tee "$LOG"
echo "[run] log=$LOG" | tee -a "$LOG"

PROMPT_FILE="$ROOT/agent-pack/prompts/01-fix-api-gateway-and-readiness.md"
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "[run] ERROR: missing $PROMPT_FILE. Run setup script first." | tee -a "$LOG"
  exit 2
fi

if command -v codex >/dev/null 2>&1; then
  echo "[run] codex CLI detected; launching with prompt file" | tee -a "$LOG"
  # This is intentionally generic; Codex CLI flags vary by install.
  # If your codex CLI supports reading stdin, this works:
  codex < "$PROMPT_FILE" 2>&1 | tee -a "$LOG" || true
  echo "[run] codex finished (or returned non-zero). Now run tests:" | tee -a "$LOG"
else
  echo "[run] Codex CLI not found. Paste the following prompt into Codex UI:" | tee -a "$LOG"
  echo "--------------------------------------------------------------------------------" | tee -a "$LOG"
  cat "$PROMPT_FILE" | tee -a "$LOG"
  echo "--------------------------------------------------------------------------------" | tee -a "$LOG"
  echo "[run] After Codex applies changes, run:" | tee -a "$LOG"
fi

cat <<'CMDS' | tee -a "$LOG"
cd ~/src/APGMS
pnpm --filter @apgms/api-gateway test
pnpm test
pnpm readiness:all
CMDS

echo "[run] done" | tee -a "$LOG"
