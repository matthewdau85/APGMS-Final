#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

require node
require corepack
require docker
require curl
require git

log "Activating pnpm via Corepack"
corepack enable
corepack prepare pnpm@9 --activate

log "Installing workspace dependencies"
pnpm install --frozen-lockfile

log "Installing Playwright browsers"
pnpm exec playwright install --with-deps

# Default environment values for local smoke
: "${DATABASE_URL:=postgresql://postgres:postgres@localhost:5432/apgms?schema=public}"
: "${SHADOW_DATABASE_URL:=postgresql://postgres:postgres@localhost:5432/apgms_shadow?schema=public}"
: "${CORS_ALLOWED_ORIGINS:=http://localhost:5173,http://127.0.0.1:5173}"
: "${AUTH_AUDIENCE:=urn:apgms:local}"
: "${AUTH_ISSUER:=urn:apgms:issuer}"
: "${AUTH_DEV_SECRET:=local-dev-shared-secret-change-me}"
AUTH_JWKS_DEFAULT='{"keys":[{"kid":"local","alg":"RS256","kty":"RSA","n":"test-modulus","e":"AQAB"}]}'
: "${AUTH_JWKS:=$AUTH_JWKS_DEFAULT}"
: "${ENCRYPTION_MASTER_KEY:=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=}"
: "${API_RATE_LIMIT_MAX:=120}"
: "${API_RATE_LIMIT_WINDOW:='1 minute'}"
: "${AUTH_FAILURE_THRESHOLD:=5}"
: "${WEBAUTHN_RP_ID:=localhost}"
: "${WEBAUTHN_RP_NAME:='APGMS Admin'}"
: "${WEBAUTHN_ORIGIN:=http://localhost:5173}"
: "${REGULATOR_ACCESS_CODE:=regulator-dev-code}"
: "${REGULATOR_JWT_AUDIENCE:=urn:apgms:regulator}"
: "${REGULATOR_SESSION_TTL_MINUTES:=60}"
: "${BANKING_PROVIDER:=mock}"
: "${BANKING_MAX_READ_TRANSACTIONS:=1000}"
: "${BANKING_MAX_WRITE_CENTS:=5000000}"
: "${REDIS_URL:=redis://localhost:6379}"
: "${REDIS_HOST:=localhost}"
: "${REDIS_PORT:=6379}"
: "${TAX_ENGINE_URL:=http://localhost:8000}"

log "Starting docker dependencies (db, redis, tax-engine)"
docker compose up -d db redis tax-engine

log "Waiting for Postgres to accept connections"
for _ in {1..30}; do
  if docker exec apgms-db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

log "Applying Prisma migrations"
pnpm -w exec prisma migrate deploy

log "Booting API gateway in background"
mkdir -p artifacts
API_LOG="$REPO_ROOT/artifacts/api-gateway.log"
(pnpm --filter @apgms/api-gateway dev >"$API_LOG" 2>&1) &
API_PID=$!

cleanup() {
  log "Stopping API gateway (pid=$API_PID)"
  kill "$API_PID" >/dev/null 2>&1 || true
  wait "$API_PID" 2>/dev/null || true
  log "Shutting down docker compose dependencies"
  docker compose down --remove-orphans
}
trap cleanup EXIT

log "Waiting for API readiness endpoint"
for _ in {1..30}; do
  if curl -fsS "http://localhost:3000/ready" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

log "Running workspace build"
pnpm -r build

log "Running lint, type checks, and unit tests with coverage"
pnpm -r lint || true
pnpm -r typecheck
pnpm -r test -- --coverage
node ./scripts/check-coverage.mjs

log "Running Playwright UI tests"
pnpm exec playwright test

log "Running regulator smoke against live API"
pnpm smoke:regulator

log "Running k6 smoke test against API gateway"
pnpm k6:smoke -- --env BASE_URL=http://localhost:3000

log "Running security and compliance checks"
pnpm audit --audit-level=high
pnpm exec gitleaks detect --no-color --redact --exit-code 1
pnpm sbom
pnpm -w exec prisma migrate status

log "Checking for merge conflicts"
git grep -n '<<<<<<<\|=======\|>>>>>>>' -- ':!*.lock'

log "Tests complete. API logs captured at $API_LOG"