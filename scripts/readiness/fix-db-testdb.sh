#!/usr/bin/env bash
set -e
set -u
set -o pipefail 2>/dev/null || true

# Normalize CRLF -> LF if the file was edited on Windows
# (safe no-op on LF files)
if command -v sed >/dev/null 2>&1; then
  sed -i 's/\r$//' "$0" 2>/dev/null || true
fi

DB_SERVICE="${DB_SERVICE:-db}"
DEFAULT_DB="${DEFAULT_DB:-apgms}"
TEST_DB_NAME_RAW="${TEST_DB_NAME:-}"
PSQL_SUPERUSER="${PSQL_SUPERUSER:-postgres}"

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
TARGET_DB="${TEST_DB_NAME_RAW:-${INFERRED_DB:-${DEFAULT_DB}}}"

die() { echo "ERROR: $*" >&2; exit 2; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing required tool: $1"; }

need docker

# Ensure we're in the repo root (best-effort)
REPO_ROOT="$(pwd)"
if [ ! -f "$REPO_ROOT/docker-compose.yml" ] && [ ! -f "$REPO_ROOT/compose.yml" ]; then
  # If user runs it from elsewhere, attempt relative path from script location
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  MAYBE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  if [ -f "$MAYBE_ROOT/docker-compose.yml" ] || [ -f "$MAYBE_ROOT/compose.yml" ]; then
    cd "$MAYBE_ROOT"
    REPO_ROOT="$(pwd)"
  fi
fi

echo "Repo root: $REPO_ROOT"
echo "Compose service: $DB_SERVICE"
echo "Target DB: $TARGET_DB (derived from DATABASE_URL or default ${DEFAULT_DB})"
echo

# Start db service if not running
if ! docker compose ps -q "$DB_SERVICE" >/dev/null 2>&1; then
  echo "db service not found (docker compose ps -q $DB_SERVICE failed)."
  echo "Make sure you are in ~/src/APGMS and that the service is named '$DB_SERVICE'."
  exit 2
fi

DB_CID="$(docker compose ps -q "$DB_SERVICE" | head -n 1 || true)"
if [ -z "$DB_CID" ]; then
  echo "db service '$DB_SERVICE' is not running. Starting it..."
  docker compose up -d "$DB_SERVICE"
  DB_CID="$(docker compose ps -q "$DB_SERVICE" | head -n 1 || true)"
fi

if [ -z "$DB_CID" ]; then
  die "Could not obtain container id for service '$DB_SERVICE'."
fi

echo "DB container id: $DB_CID"
echo "Waiting for Postgres to accept connections..."
# Wait up to ~30s for readiness
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if docker compose exec -T "$DB_SERVICE" pg_isready -U "$PSQL_SUPERUSER" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker compose exec -T "$DB_SERVICE" pg_isready -U "$PSQL_SUPERUSER" >/dev/null 2>&1; then
  echo "Postgres is not ready. Recent logs:"
  docker compose logs --tail=80 "$DB_SERVICE" || true
  exit 2
fi

echo "Postgres is ready."
echo

echo "Checking whether database '$TARGET_DB' exists..."
EXISTS="$(docker compose exec -T "$DB_SERVICE" psql -U "$PSQL_SUPERUSER" -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${TARGET_DB}'" 2>/dev/null | tr -d '[:space:]' || true)"

if [ "$EXISTS" = "1" ]; then
  echo "OK: database '$TEST_DB_NAME' already exists."
else
  echo "Creating database '$TEST_DB_NAME'..."
  docker compose exec -T "$DB_SERVICE" psql -U "$PSQL_SUPERUSER" -v ON_ERROR_STOP=1 -c \
    "CREATE DATABASE \"${TARGET_DB}\";"
  echo "Created database '$TARGET_DB'."
fi

echo
echo "Done."
echo
echo "Next:"
echo "  1) Restart whatever is running on port 3000 (API gateway) so it reconnects to DB."
echo "  2) Re-test readiness:"
echo "       curl -i http://localhost:3000/ready"
echo "       pnpm readiness:all"
