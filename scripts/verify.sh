#!/usr/bin/env bash
set -euo pipefail

banner() {
  echo "=============================================="
  echo "APGMS Deep Verification — Boundary & Integrity"
  echo "=============================================="
  echo
}

step() {
  echo
  echo "▶ $1"
}

fail() {
  echo "❌ VERIFY FAILED: $1" >&2
  exit 1
}

banner

step "1) TypeScript + build integrity"
# lint markdown should not block boundary testing; config controls strictness
pnpm lint:markdown || fail "Lint failed"

# Ensure workspace builds before any cross-package typecheck (dist/types must exist)
pnpm -r build || fail "Build failed"

pnpm -r typecheck || fail "TypeScript typecheck failed"

step "2) Unit/integration tests"
pnpm -r test || fail "Tests failed"

step "3) Determinism / outcome engine smoke"
# Keep this targeted so it actually tests the policy engine logic
pnpm --filter @apgms/domain-policy test || fail "domain-policy tests failed"

step "4) API gateway route registration sanity"
pnpm --filter @apgms/api-gateway test || fail "api-gateway tests failed"
pnpm --filter @apgms/api-gateway typecheck || fail "api-gateway typecheck failed"

echo
echo "✅ VERIFY PASSED"
