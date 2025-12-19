#!/usr/bin/env bash
set -euo pipefail

# ---------- logging setup ----------
TIMESTAMP="$(date -Iseconds | sed 's/[:]/-/g')"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/apgms-gates-$TIMESTAMP.log"

# Mirror stdout+stderr to terminal and log file
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[run-all-gates] starting at $(date)"
echo "[run-all-gates] log file: $LOG_FILE"
echo

step() {
  echo
  echo "==============================="
  echo "STEP: $*"
  echo "==============================="
}

# ---------- 1. Install + browsers ----------
step "1. Install dependencies and Playwright browsers"
pnpm install
pnpm exec playwright install --with-deps

# ---------- 2. API gateway tests + coverage ----------
step "2. API gateway Jest tests + coverage gate"
pnpm --filter @apgms/api-gateway test
pnpm --filter @apgms/api-gateway run check:coverage

# ---------- 3. Prisma drift ----------
step "3. Prisma migrate status (drift check)"
pnpm -w exec prisma migrate status --schema infra/prisma/schema.prisma

# ---------- 4. SBOM + SCA ----------
step "4. SBOM generation and SCA (npm audit via pnpm scripts)"

# SBOM is best-effort: log failure but don't abort the whole run
if pnpm run sbom; then
  echo "[SBOM] sbom.xml generated successfully (or tool reported success)."
else
  echo "[SBOM] WARNING: pnpm run sbom failed (see above for details). Continuing anyway."
fi

echo
echo "[audit] production dependencies (hard gate)"
pnpm run audit:prod

echo
echo "[audit] dev dependencies (noisy / soft gate)"
pnpm run audit:dev || {
  echo "[audit:dev] Non-zero exit (expected for noisy dev audit). Continuing."
}

# ---------- 5. Secrets & filesystem scan ----------
step "5. Secrets and filesystem scan (gitleaks + trivy)"
gitleaks detect --no-color --redact --exit-code 1
trivy fs . --severity HIGH,CRITICAL --exit-code 1

# ---------- 6. Accessibility (Playwright + Axe) ----------
step "6. Accessibility checks (Playwright a11y spec + webapp Axe tests)"

# Playwright a11y spec
pnpm -w exec playwright test webapp/tests/a11y.spec.ts

# Jest + axe in webapp
pnpm --filter @apgms/webapp test:axe

# ---------- 7. Operational smoke ----------
step "7. Operational smoke (k6 + health/ready/metrics)"

# k6 smoke test (expects k6 script wired to this script name)
pnpm k6:smoke

# Simple HTTP health checks against a running instance on :3000
curl -sf http://localhost:3000/health
curl -sf http://localhost:3000/ready
curl -sf http://localhost:3000/metrics

echo
echo "[run-all-gates] COMPLETE at $(date)"
echo "[run-all-gates] log file: $LOG_FILE"
