#!/usr/bin/env bash
set -euo pipefail

# APGMS demo/build/test runner (WSL/Linux)
# - Bootstraps deps
# - Brings up db + redis via docker compose
# - Runs prisma generate + migrate deploy/status
# - Runs db smoke + verify + typecheck + build + prod-mode api tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { printf "\n=== %s ===\n" "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not on PATH."; }

KEEP_DOCKER=0
SKIP_INSTALL=0
SKIP_BUILD=0
SKIP_TYPECHECK=0
SKIP_VERIFY=0
SKIP_TESTS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-docker) KEEP_DOCKER=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-typecheck) SKIP_TYPECHECK=1 ;;
    --skip-verify) SKIP_VERIFY=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help)
      cat <<EOF
Usage: ./scripts/demo-build-test.sh [options]

Options:
  --keep-docker     Do not docker compose down on exit
  --skip-install    Skip pnpm install
  --skip-build      Skip pnpm -r build
  --skip-typecheck  Skip pnpm -r typecheck
  --skip-verify     Skip ./scripts/verify.sh
  --skip-tests      Skip api-gateway jest tests (prod-mode guard)
EOF
      exit 0
      ;;
    *) die "Unknown arg: $1" ;;
  esac
  shift
done

cd "$REPO_ROOT"

cleanup() {
  if [[ "$KEEP_DOCKER" -eq 0 ]]; then
    # only tear down what we started
    docker compose stop db redis >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

log "APGMS demo/build/test (WSL)"
echo "Repo: $REPO_ROOT"
echo "User: $(whoami)"
echo "OS: $(uname -a)"

need node
need pnpm

# Corepack is optional, but nice to have.
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

log "Install deps"
if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  pnpm install --frozen-lockfile
fi

# Canonical schema path (repo-root absolute)
SCHEMA_PATH="${REPO_ROOT}/infra/prisma/schema.prisma"
[[ -f "$SCHEMA_PATH" ]] || die "Prisma schema not found at: $SCHEMA_PATH"

# Local dev defaults that match docker-compose.yml db service (postgres/postgres@localhost:5432/apgms)
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/apgms?schema=public}"
export SHADOW_DATABASE_URL="${SHADOW_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/apgms?schema=public}"

log "Start DB + Redis (docker compose)"
need docker
docker compose up -d db redis

log "Wait for DB (port 5432)"
for i in $(seq 1 60); do
  if (echo >/dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 60 ]]; then
    docker compose ps || true
    die "DB did not become reachable on 127.0.0.1:5432"
  fi
done

log "Prisma generate"
# This matches CI's "pnpm prisma:generate" step; run from repo root.
pnpm prisma:generate

log "Prisma migrate deploy"
pnpm -w exec prisma migrate deploy --schema "$SCHEMA_PATH"

log "Prisma migrate status"
pnpm -w exec prisma migrate status --schema "$SCHEMA_PATH"

log "DB smoke"
pnpm db:smoke

log "Verify (repo)"
if [[ "$SKIP_VERIFY" -eq 0 ]]; then
  bash ./scripts/verify.sh
fi

log "Typecheck"
if [[ "$SKIP_TYPECHECK" -eq 0 ]]; then
  pnpm -r typecheck
fi

log "Build"
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  pnpm -r build
fi

log "API Gateway tests (production-mode guard)"
if [[ "$SKIP_TESTS" -eq 0 ]]; then
  NODE_ENV=production pnpm --filter @apgms/api-gateway test
fi

log "DONE"
echo "DATABASE_URL=$DATABASE_URL"
echo "Schema: $SCHEMA_PATH"
