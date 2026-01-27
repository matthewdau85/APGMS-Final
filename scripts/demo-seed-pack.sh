#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"

# These align with services/api-gateway/src/demo/case-studies.ts conventions
ORG_ID="${ORG_ID:-demo-org-001}"
CASE_ID="${CASE_ID:-SOLO_TRADER}"
SEED="${SEED:-apgms-demo-seed-001}"

# Optional: makes deterministic time-based artifacts stable if your endpoint accepts it
NOW_TS="${NOW_TS:-}"

payload() {
  if [ -n "${NOW_TS}" ]; then
    printf '{"orgId":"%s","caseId":"%s","seed":"%s","nowTs":%s}\n' "$ORG_ID" "$CASE_ID" "$SEED" "$NOW_TS"
  else
    printf '{"orgId":"%s","caseId":"%s","seed":"%s"}\n' "$ORG_ID" "$CASE_ID" "$SEED"
  fi
}

echo "[demo-seed] API_BASE=${API_BASE}"
echo "[demo-seed] orgId=${ORG_ID} caseId=${CASE_ID} seed=${SEED} nowTs=${NOW_TS:-<server_default>}"

curl -fsS \
  -H "content-type: application/json" \
  -d "$(payload)" \
  "${API_BASE}/demo/seed" | cat

echo
echo "[demo-seed] OK"
