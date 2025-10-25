# APGMS

## Prerequisites

* Node 18.x, PNPM 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
* Docker & Docker Compose
* Playwright browsers: `pnpm exec playwright install --with-deps`
* (Optional for smoke) k6 installed locally

## Environment

Create `.env` files at package roots as needed. **Gateway hard-start checks**:

* `CORS_ALLOWED_ORIGINS` **must be set** (comma-separated) or the API refuses to start.
* KMS keyset must be available/loaded or the API refuses to start.

Example (root `.env` or `services/api-gateway/.env`):

```
CORS_ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=postgres://postgres:postgres@localhost:5432/apgms
SHADOW_DATABASE_URL=postgres://postgres:postgres@localhost:5432/apgms_shadow
JWT_SECRET=dev_only_change_me
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
```

> KMS dev keys: store JSON key material under `artifacts/kms/` (git-ignored). The directory is tracked via `.gitkeep`.
> Rotate keys: `pnpm security:rotate-keys --write-env .env` (omit `--write-env` to dry-run).

---

## Quickstart (local)

```bash
pnpm i --frozen-lockfile
pnpm -r build
docker compose up -d
pnpm -w exec prisma migrate deploy
pnpm --filter @apgms/api-gateway dev   # API on :3000
```

Verify:

```bash
curl -sf http://localhost:3000/health
curl -sf http://localhost:3000/ready
curl -sf http://localhost:3000/metrics
```

---

## Quality & Security Gates (local mirrors of CI)

Run these before pushing. They match the CI jobs and "blockers".

```bash
# Type safety
pnpm -r typecheck

# Tests + coverage (≥ 85% enforced)
pnpm -r test -- --coverage
node ./scripts/check-coverage.mjs

# Dependency SCA (fail on high/critical)
pnpm audit --audit-level=high

# Secret scanning (redacted output)
curl -sSL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks-linux-amd64 -o gitleaks && chmod +x gitleaks
./gitleaks detect --no-color --redact --exit-code 1

# SBOM (CycloneDX) at repo root -> sbom.json
pnpm sbom

# Schema drift
pnpm -w exec prisma migrate status

# Merge-conflict guard
git grep -n '<<<<<<<\|=======\|>>>>>>>' -- ':!*.lock' || true
```

---

## Accessibility & Performance

```bash
# A11y smoke (fast fail)
pnpm -w exec playwright test webapp/tests/a11y.spec.ts

# WCAG 2.1 A/AA checks (per-route axe scan)
pnpm --filter @apgms/webapp test:axe

# (Optional) Lighthouse locally, if lhci is installed
# pnpm -w exec lhci autorun --config=./lighthouserc.json
```

---

## Operational Smoke

After the gateway is up:

```bash
pnpm k6:smoke -- --env BASE_URL=http://localhost:3000
```

---

## Release compliance

* Follow `docs/compliance/checklist.md` and attach **evidence artifacts** for each run.
* Publish dashboards from `docs/ops/dashboards.md` to the status site when applicable.

**Suggested evidence bundle (per release):**

```bash
STAMP=$(date +%Y-%m-%dT%H%M%S)
OUT=artifacts/compliance/$STAMP && mkdir -p "$OUT"

# Save evidence
pnpm -r test -- --coverage && cp -r coverage "$OUT/coverage"
node ./scripts/check-coverage.mjs 2>&1 | tee "$OUT/coverage_gate.txt"
pnpm audit --audit-level=high 2>&1 | tee "$OUT/sca.txt"
./gitleaks detect --no-color --redact --exit-code 1 2>&1 | tee "$OUT/gitleaks.txt" || true
pnpm sbom && mv sbom.json "$OUT/sbom.json"
pnpm -w exec prisma migrate status 2>&1 | tee "$OUT/prisma_status.txt"
curl -sSf http://localhost:3000/ready -o "$OUT/ready.json"
curl -sSf http://localhost:3000/metrics -o "$OUT/metrics.prom" || true
```

---

## Pushing your changes

```bash
git checkout -b hardening/compliance-5-2
git add -A
git commit -m "docs(readme): align local workflow with 5.2 compliance gates"
git push -u origin hardening/compliance-5-2
```
