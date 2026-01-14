#!/usr/bin/env bash
set -euo pipefail

# If this file was edited on Windows, normalize CRLF -> LF (safe no-op otherwise)
sed -i 's/\r$//' "$0" 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE="${COMPOSE:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
API_SERVICE="${API_SERVICE:-api-gateway}"
DEFAULT_DB="${DEFAULT_DB:-apgms}"
TARGET_DB_RAW="${TARGET_DB:-}"
READY_URL="${READY_URL:-http://localhost:3000/ready}"

infer_db_from_url() {
  local url="$1"
  if [ -z "${url}" ]; then
    return
  fi
  if [[ "${url}" =~ ^[^/]+//[^/]+/([^?]+) ]]; then
    printf "%s" "${BASH_REMATCH[1]}"
  fi
}

INFERRED_DB="$(infer_db_from_url "${DATABASE_URL:-}")"
TARGET_DB="${TARGET_DB_RAW:-${INFERRED_DB:-${DEFAULT_DB}}}"

echo "Repo root: $ROOT"
echo "Compose: $COMPOSE"
echo "DB service: $DB_SERVICE"
echo "API service: $API_SERVICE"
echo "Target DB: $TARGET_DB (derived from DATABASE_URL or default ${DEFAULT_DB})"
echo "Ready URL: $READY_URL"
echo

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: Missing required tool: $1" >&2; exit 2; }; }
need docker
need curl
need sed

echo "== 1) Ensure compose services are up =="
$COMPOSE up -d "$DB_SERVICE" "$API_SERVICE" >/dev/null
echo "OK"
echo

echo "== 2) Wait for Postgres to be ready =="
# pg_isready exists in the postgres image; loop until it reports ready
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if $COMPOSE exec -T "$DB_SERVICE" pg_isready -U postgres >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  echo "Waiting for Postgres... ($i/15)"
  sleep 1
done

if ! $COMPOSE exec -T "$DB_SERVICE" pg_isready -U postgres >/dev/null 2>&1; then
  echo "ERROR: Postgres did not become ready." >&2
  $COMPOSE logs --tail=200 "$DB_SERVICE" || true
  exit 1
fi
echo

echo "== 3) Ensure database '$TARGET_DB' exists =="
# Check existence
if $COMPOSE exec -T "$DB_SERVICE" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${TARGET_DB}'" | grep -q 1; then
  echo "Database '$TARGET_DB' already exists."
else
  echo "Creating database '$TARGET_DB'..."
  $COMPOSE exec -T "$DB_SERVICE" psql -U postgres -c "CREATE DATABASE ${TARGET_DB};"
  echo "Created database '$TARGET_DB'."
fi
echo

echo "== 4) Restart api-gateway (so it reconnects) =="
$COMPOSE restart "$API_SERVICE" >/dev/null
echo "Restarted $API_SERVICE."
echo

echo "== 5) Wait for /ready to return 200 =="
# Print current status quickly
echo "Current /ready (may be 503 initially):"
curl -sS -i "$READY_URL" | sed -n '1,20p' || true
echo

max_tries="${MAX_TRIES:-120}"
sleep_s="${SLEEP_SECONDS:-1}"

for i in $(seq 1 "$max_tries"); do
  code="$(curl -sS -o /tmp/apgms-ready.json -w '%{http_code}' "$READY_URL" || echo "000")"
  if [ "$code" = "200" ]; then
    echo "OK: /ready returned 200 (attempt $i/$max_tries)."
    cat /tmp/apgms-ready.json || true
    echo
    echo "Next:"
    echo "  pnpm readiness:all"
    echo "  pnpm readiness:chain"
    exit 0
  fi

  # Keep showing the body because it tells us what check is failing.
  body="$(cat /tmp/apgms-ready.json 2>/dev/null || true)"
  echo "/ready not 200 yet (attempt $i/$max_tries): HTTP $code  body: $body"
  sleep "$sleep_s"
done

echo
echo "ERROR: /ready never returned 200 within ${max_tries} attempts." >&2
echo
echo "---- api-gateway logs (tail 200) ----" >&2
$COMPOSE logs --tail=200 "$API_SERVICE" >&2 || true
echo
echo "---- db logs (tail 200) ----" >&2
$COMPOSE logs --tail=200 "$DB_SERVICE" >&2 || true
exit 1
