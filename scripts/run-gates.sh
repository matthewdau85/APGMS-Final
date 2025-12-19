#!/usr/bin/env bash
set -euo pipefail

cd /mnt/c/src/apgms

echo "== Node & pnpm =="
node -v
pnpm -v

echo
echo "== API gateway tests =="
pnpm --filter @apgms/api-gateway test
pnpm --filter @apgms/api-gateway run check:coverage

echo
echo "== Prisma drift =="
pnpm -w exec prisma migrate status --schema infra/prisma/schema.prisma

echo
echo "== SBOM + check =="
pnpm run sbom
pnpm run check:sbom

echo
echo "== Audits =="
pnpm run audit:prod
pnpm run audit:dev || echo "[audit:dev] non-zero exit (dev-tool vulns only)"

echo
echo "== A11y (Playwright WCAG) =="
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 \
  pnpm -w exec playwright test webapp/tests/a11y.spec.ts

echo
echo "== A11y (webapp Axe tests) =="
pnpm --filter @apgms/webapp test:axe

echo
echo "== Secrets & FS scans =="
gitleaks detect --no-color --redact --exit-code 1
trivy fs . --severity HIGH,CRITICAL --exit-code 1

echo
echo "== Operational smoke =="
pnpm k6:smoke
curl -sf http://localhost:3000/health
curl -sf http://localhost:3000/ready
curl -sf http://localhost:3000/metrics

echo
echo "== Gates complete =="
