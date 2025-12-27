#!/usr/bin/env bash
set -euo pipefail

RED="\033[0;31m"
GREEN="\033[0;32m"
NC="\033[0m"

fail() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

step() {
  echo
  echo "▶ $1"
}

echo "=============================================="
echo "APGMS Deep Verification — Boundary & Integrity"
echo "=============================================="
echo

step "1) TypeScript + build integrity"
pnpm lint:markdown || fail "markdown lint failed"
pnpm -r build || fail "build failed"
pnpm -r typecheck || fail "typecheck failed"

step "2) Unit/integration tests"
pnpm -r test || fail "tests failed"

step "3) Determinism / outcome engine smoke"
pnpm --filter @apgms/domain-policy test || fail "domain-policy tests failed"

step "4) API gateway route registration sanity"
pnpm --filter @apgms/api-gateway test || fail "api-gateway tests failed"
pnpm --filter @apgms/api-gateway typecheck || fail "api-gateway typecheck failed"

echo
echo -e "${GREEN}✅ VERIFY PASSED${NC}"
