#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
MUTATE="${VERIFY_SETUP_MUTATE:-0}"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

echo "[time_utc] $(ts)"
echo "[api_base] $API_BASE"
echo "[mutate] $MUTATE"
echo

req() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local url="$API_BASE$path"

  if [[ -n "$body" ]]; then
    curl -sS -X "$method" \
      -H "content-type: application/json" \
      -d "$body" \
      "$url"
  else
    curl -sS -X "$method" "$url"
  fi
}

code() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local url="$API_BASE$path"

  if [[ -n "$body" ]]; then
    curl -sS -o /dev/null -w "%{http_code}" -X "$method" \
      -H "content-type: application/json" \
      -d "$body" \
      "$url"
  else
    curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url"
  fi
}

echo "============================================================"
echo "0) Readiness check"
echo "============================================================"
c="$(code GET /ready)"
echo "[GET] /ready -> $c"
req GET /ready || true
echo

echo "============================================================"
echo "1) Org setup status"
echo "============================================================"
c="$(code GET /org/setup-status)"
echo "[GET] /org/setup-status -> $c"
req GET /org/setup-status || true
echo

echo "============================================================"
echo "2) Connector catalog"
echo "============================================================"
c="$(code GET /org/setup/connector-catalog)"
echo "[GET] /org/setup/connector-catalog -> $c"
req GET /org/setup/connector-catalog || true
echo

if [[ "$MUTATE" == "1" ]]; then
  echo "============================================================"
  echo "3) MUTATE: create first admin"
  echo "============================================================"
  body='{"email":"admin@example.com","name":"Admin","password":"ChangeMe123!"}'
  c="$(code POST /org/setup/first-admin "$body")"
  echo "[POST] /org/setup/first-admin -> $c"
  req POST /org/setup/first-admin "$body" || true
  echo

  echo "============================================================"
  echo "4) MUTATE: configure connectors"
  echo "============================================================"
  body='{"connectors":[
    {"sector":"banking","vendor":"CBA","mode":"mock","displayName":"Commonwealth Bank","config":{"sandbox":true}},
    {"sector":"accounting","vendor":"Xero","mode":"mock","displayName":"Xero","config":{"sandbox":true}},
    {"sector":"payments","vendor":"Stripe","mode":"mock","displayName":"Stripe","config":{"sandbox":true}}
  ]}'
  c="$(code POST /org/setup/connectors "$body")"
  echo "[POST] /org/setup/connectors -> $c"
  req POST /org/setup/connectors "$body" || true
  echo

  echo "============================================================"
  echo "5) MUTATE: complete setup"
  echo "============================================================"
  c="$(code POST /org/setup/complete "{}")"
  echo "[POST] /org/setup/complete -> $c"
  req POST /org/setup/complete "{}" || true
  echo

  echo "============================================================"
  echo "6) Verify status after mutate"
  echo "============================================================"
  c="$(code GET /org/setup-status)"
  echo "[GET] /org/setup-status -> $c"
  req GET /org/setup-status || true
  echo
fi
