#!/usr/bin/env bash
# scripts/verify-setup.sh
# APGMS setup verification runner (WSL-friendly, minimal deps).
# - Default is READ-ONLY checks. Set VERIFY_SETUP_MUTATE=1 to attempt setup mutations.
# - Tries to auto-discover endpoint prefixes if your paths differ.

set -u

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
TIMEOUT_SECS="${TIMEOUT_SECS:-10}"
VERIFY_SETUP_MUTATE="${VERIFY_SETUP_MUTATE:-0}"

# Set STRICT=1 to stop on unexpected command errors
STRICT="${STRICT:-0}"
if [[ "$STRICT" == "1" ]]; then
  set -euo pipefail
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[FAIL] curl is required"
  exit 1
fi

_tmpdir="$(mktemp -d)"
trap 'rm -rf "$_tmpdir"' EXIT

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

curl_code_body() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local out="$_tmpdir/out.json"
  local code

  if [[ "$method" == "GET" ]]; then
    code="$(curl -sS -m "$TIMEOUT_SECS" -o "$out" -w "%{http_code}" \
      -H "Accept: application/json" \
      "${API_BASE}${path}" || echo "000")"
  else
    code="$(curl -sS -m "$TIMEOUT_SECS" -o "$out" -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      -X "$method" \
      --data "$data" \
      "${API_BASE}${path}" || echo "000")"
  fi

  echo "$code"
  cat "$out" 2>/dev/null || true
}

print_section() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

# Probe helper: choose the first path that is not 404.
# Treat 200/201/204 as success; treat 401/403 as "exists but needs auth".
probe_get_first_existing() {
  local label="$1"; shift
  local paths=("$@")

  for p in "${paths[@]}"; do
    local code_and_body
    code_and_body="$(curl_code_body "GET" "$p")"
    local code="${code_and_body%%$'\n'*}"
    local body="${code_and_body#*$'\n'}"

    if [[ "$code" != "404" && "$code" != "000" ]]; then
      echo "$p|$code|$body"
      return 0
    fi
  done

  echo "||404|"
  return 1
}

probe_post_first_existing() {
  local label="$1"; shift
  local json="$1"; shift
  local paths=("$@")

  for p in "${paths[@]}"; do
    local code_and_body
    code_and_body="$(curl_code_body "POST" "$p" "$json")"
    local code="${code_and_body%%$'\n'*}"
    local body="${code_and_body#*$'\n'}"

    if [[ "$code" != "404" && "$code" != "000" ]]; then
      echo "$p|$code|$body"
      return 0
    fi
  done

  echo "||404|"
  return 1
}

echo "[time_utc] $(ts)"
echo "[api_base] $API_BASE"
echo "[mutate] $VERIFY_SETUP_MUTATE"
echo

# Candidate prefixes (extend if needed)
PREFIXES=("" "/api" "/v1" "/demo" "/prototype")

# Candidate status routes (joined with prefixes)
status_candidates=()
for pre in "${PREFIXES[@]}"; do
  status_candidates+=("${pre}/org/setup-status")
  status_candidates+=("${pre}/setup/status")
  status_candidates+=("${pre}/setup/setup-status")
done

print_section "0) Readiness check (optional)"
# Probe common readiness paths
ready_candidates=()
for pre in "${PREFIXES[@]}"; do
  ready_candidates+=("${pre}/ready")
  ready_candidates+=("${pre}/health")
  ready_candidates+=("${pre}/healthz")
done

ready_probe="$(probe_get_first_existing "ready" "${ready_candidates[@]}")"
ready_path="${ready_probe%%|*}"
ready_rest="${ready_probe#*|}"
ready_code="${ready_rest%%|*}"
ready_body="${ready_rest#*|}"

if [[ -n "$ready_path" && "$ready_code" != "404" ]]; then
  echo "[GET] ${ready_path} -> ${ready_code}"
  echo "$ready_body"
else
  echo "[WARN] No readiness endpoint found (tried /ready,/health,/healthz with common prefixes). Continuing."
fi

print_section "1) Org setup status (auto-discover)"
status_probe="$(probe_get_first_existing "setup-status" "${status_candidates[@]}")"
status_path="${status_probe%%|*}"
status_rest="${status_probe#*|}"
status_code="${status_rest%%|*}"
status_body="${status_rest#*|}"

if [[ -z "$status_path" || "$status_code" == "404" ]]; then
  echo "[FAIL] Could not find a setup status endpoint."
  echo "Tried:"
  for p in "${status_candidates[@]}"; do echo "  - $p"; done
  echo
  echo "Next actions:"
  echo "  1) Open http://localhost:5173/setup and check DevTools Network for the real API paths."
  echo "  2) Run: rg -n \"setup-status|setupComplete|/setup|/org/setup\" services/api-gateway/src"
  exit 2
fi

echo "[GET] ${status_path} -> ${status_code}"
echo "$status_body"

if [[ "$status_code" == "401" || "$status_code" == "403" ]]; then
  echo
  echo "[INFO] The endpoint exists but requires auth (${status_code})."
  echo "This script currently does not login and attach a token."
  exit 0
fi

# Read-only mode ends here
if [[ "$VERIFY_SETUP_MUTATE" != "1" ]]; then
  echo
  echo "[INFO] Read-only mode. To attempt automated setup steps, run:"
  echo "  VERIFY_SETUP_MUTATE=1 API_BASE=$API_BASE ./scripts/verify-setup.sh"
  exit 0
fi

# If you get here, you likely need to align the following endpoints to your backend.
# We keep them probe-based too.

print_section "2) Register first admin (probe)"
register_candidates=()
for pre in "${PREFIXES[@]}"; do
  register_candidates+=("${pre}/auth/register-first-admin")
  register_candidates+=("${pre}/auth/register-first-admin-user")
  register_candidates+=("${pre}/setup/register-first-admin")
done

register_payload='{"username":"admin","password":"ChangeMe123!","orgName":"APGMS Demo Org"}'
reg_probe="$(probe_post_first_existing "register" "$register_payload" "${register_candidates[@]}")"
reg_path="${reg_probe%%|*}"
reg_rest="${reg_probe#*|}"
reg_code="${reg_rest%%|*}"
reg_body="${reg_rest#*|}"

if [[ -z "$reg_path" || "$reg_code" == "404" ]]; then
  echo "[WARN] No admin registration endpoint found. Skipping."
else
  echo "[POST] ${reg_path} -> ${reg_code}"
  echo "$reg_body"
fi

print_section "3) Save connector instances (probe)"
save_candidates=()
for pre in "${PREFIXES[@]}"; do
  save_candidates+=("${pre}/org/setup/connectors")
  save_candidates+=("${pre}/setup/connectors")
done

connectors_payload='{"connectors":[{"instanceId":"mock-xero-1","connectorId":"xero","mode":"mock","displayName":"Xero (Mock)","enabled":true,"config":{"scenario":"happy_path"}}]}'
save_probe="$(probe_post_first_existing "save-connectors" "$connectors_payload" "${save_candidates[@]}")"
save_path="${save_probe%%|*}"
save_rest="${save_probe#*|}"
save_code="${save_rest%%|*}"
save_body="${save_rest#*|}"

if [[ -z "$save_path" || "$save_code" == "404" ]]; then
  echo "[WARN] No connector-save endpoint found. Skipping."
else
  echo "[POST] ${save_path} -> ${save_code}"
  echo "$save_body"
fi

print_section "4) Complete setup (probe)"
complete_candidates=()
for pre in "${PREFIXES[@]}"; do
  complete_candidates+=("${pre}/org/setup/complete")
  complete_candidates+=("${pre}/setup/complete")
done

complete_probe="$(probe_post_first_existing "complete" "{}" "${complete_candidates[@]}")"
complete_path="${complete_probe%%|*}"
complete_rest="${complete_probe#*|}"
complete_code="${complete_rest%%|*}"
complete_body="${complete_rest#*|}"

if [[ -z "$complete_path" || "$complete_code" == "404" ]]; then
  echo "[WARN] No setup-complete endpoint found. Skipping."
else
  echo "[POST] ${complete_path} -> ${complete_code}"
  echo "$complete_body"
fi

echo
echo "[DONE] verify-setup completed"
