#!/usr/bin/env bash
set -u

FAIL=0

step () {
  echo ""
  echo "▶ $1"
  shift
  if ! "$@"; then
    echo "❌ FAILED: $1"
    FAIL=1
  else
    echo "✅ PASSED: $1"
  fi
}

echo "========================================"
echo "APGMS — FULL VERIFICATION RUN"
echo "========================================"

step "Guard: infra packages must not enable coverage" \
  pnpm guard:infra-coverage

step "Workspace typecheck" \
  pnpm -r typecheck

step "Domain-policy tests (WITH coverage)" \
  pnpm --filter @apgms/domain-policy test -- --coverage

step "Assurance drills" \
  pnpm --filter @apgms/domain-policy test -- assurance

step "Ledger tests (NO coverage)" \
  pnpm --filter @apgms/ledger test

step "API Gateway tests (NO coverage)" \
  pnpm --filter @apgms/api-gateway test

step "Secret scanning" \
  pnpm scan:secrets

step "Dependency audit" \
  pnpm audit --audit-level=high

step "Readiness checks (API must be running)" \
  pnpm readiness:all

echo ""
echo "========================================"

if [ "$FAIL" -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED"
else
  echo "⚠️  SOME CHECKS FAILED"
fi

echo "========================================"

exit "$FAIL"
