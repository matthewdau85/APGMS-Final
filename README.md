# APGMS

## Prerequisites

* Node 20.11.x (respect `.nvmrc` / `.tool-versions`; `nvm use` or `asdf install` will pick this up)
* PNPM 9 via Corepack (`corepack enable && corepack prepare pnpm@9 --activate`)
* Docker & Docker Compose
* Playwright browsers: `pnpm exec playwright install --with-deps`
* (Optional for smoke) k6 installed locally

## Environment

Create `.env` files at package roots as needed. **Gateway hard-start checks**:

* `CORS_ALLOWED_ORIGINS` **must be set** (comma-separated) or the API refuses to start.
* KMS keyset must be available/loaded or the API refuses to start.

Example (root `.env` or `services/api-gateway/.env`):

```
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/apgms?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/apgms_shadow?schema=public
AUTH_AUDIENCE=urn:apgms:local
AUTH_ISSUER=urn:apgms:issuer
AUTH_DEV_SECRET=local-dev-shared-secret-change-me
AUTH_JWKS={"keys":[{"kid":"local","alg":"RS256","kty":"RSA","n":"replace-with-base64url-modulus","e":"AQAB"}]}
ENCRYPTION_MASTER_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
API_RATE_LIMIT_MAX=120
API_RATE_LIMIT_WINDOW=1 minute
AUTH_FAILURE_THRESHOLD=5
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=APGMS Admin
WEBAUTHN_ORIGIN=http://localhost:5173
REGULATOR_ACCESS_CODE=regulator-dev-code
REGULATOR_JWT_AUDIENCE=urn:apgms:regulator
REGULATOR_SESSION_TTL_MINUTES=60
BANKING_PROVIDER=mock
BANKING_MAX_READ_TRANSACTIONS=1000
BANKING_MAX_WRITE_CENTS=5000000
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

## API Idempotency

All mutating REST endpoints now require an `Idempotency-Key` header. Replays with the same key will return the original response payload and a response header `Idempotent-Replay: true`. Re-using a key with different payload, actor, or org scope is rejected with `409 idempotency_conflict`. Generate a fresh key for each unique write operation and persist it across retries.

---

## Quality & Security Gates (local mirrors of CI)

Run these before pushing. They match the CI jobs and "blockers".

```bash
# Type safety
pnpm -r typecheck

# Tests + coverage (>= 85% enforced)
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

## ATO DSP Registration

* **Product ID:** `DSP-PRD-8742`
* **Application package:** `runbooks/compliance/ato-dsp-registration.md` (submission log, liaison feedback, evidence links).
* **OSF / STP evidence:** indexed under `docs/dsp-osf/evidence-index.md` with source artifacts inside `artifacts/compliance/`.
* **Security bundle:** `artifacts/compliance/security-bundle-20250301.md` (ASVS, TFN SOP, incident response references).
* **Status updates:** add follow-up actions + monitoring outputs to `status/README.md` after each quarterly review.

Share the product ID with regulators, banking partners, and Customer Success decks. Reference this section in onboarding materials so new teams can locate the latest evidence quickly.

---

## Pushing your changes

```bash
git checkout -b hardening/compliance-5-2
git add -A
git commit -m "docs(readme): align local workflow with 5.2 compliance gates"
git push -u origin hardening/compliance-5-2
```

### Branch hygiene expectations

Regulators routinely ask for a provable audit trail of the documentation updates above. To keep the repository audit-ready:

1. Run `git status -sb` and identify every unstaged file.
2. Stage the change (`git add .` for bulk updates or `git add <path>` when isolating a single artifact).
3. Commit with a descriptive message that matches the evidence being added ("docs(osf): attach Feb questionnaire" instead of a generic "update docs").
4. Push the commit to the canonical branch (`git push origin main`).
5. If feature branches mirror compliance artefacts, push them as well (`git push --all origin`) so every branch stays updated.

Repeat the stage/commit/push loop for each logical change until `git status` reports a clean working tree.
