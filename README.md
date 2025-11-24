APGMS – Automated PAYGW & GST Management System

Status: Prototype • AU-only • Designed for ATO DSP Operational Security Framework (OSF) alignment
Scope: PAYGW, GST, BAS automation, one-way designated accounts, regulator view, audit guarantees.

APGMS is an Australian-only platform providing hardened, DSP-grade management of PAYGW and GST liabilities, including:

Automated PAYGW/GST calculation using versioned configuration tables.

Designated one-way accounts ensuring PAYGW/GST cannot be misused as operating cash.

ATO-grade audit trails (idempotency, immutable ledgers, shortfall tracking, reconciliation).

Regulator views and APIs consistent with ATO DSP OSF requirements.

End-to-end encryption of TFN/ABN/BSB/account numbers using AES-256-GCM envelopes.

Monorepo Structure
APGMS-Final/
├── services/
│   ├── api-gateway/      # Fastify API gateway, auth, MFA, security headers, regulator routes
│   └── connectors/       # Bank/ATO provider scaffolding (mock + real)
├── packages/
│   ├── domain-policy/    # AU tax engines, designated account policy, rules
│   └── ledger/           # Double-entry ledger engine, journal & tests
├── shared/               # Shared Prisma schema, client, cross-cutting utils (crypto, redaction)
├── apps/
│   └── phase1-demo/      # UI demo for Phase 1 flows
├── webapp/               # Main UI (React/Vite)
├── worker/               # Background jobs (parameter updates, projections)
└── artifacts/            # KMS keys, compliance evidence bundles (gitignored except .gitkeep)

AU-Only Tax Scope

APGMS limits itself to the Australian tax system only for tightness of compliance and correctness:

BAS, PAYGW and GST are implemented through versioned config tables.

Engines do not hardcode thresholds or rates.

Future extensions (PAYGI, FBT, company tax) remain AU-only.

Aligns with ATO's DSP Operational Security Framework by design.

Prerequisites
Required

Node.js 20.11.x
(Use .nvmrc or .tool-versions; supports nvm use or asdf install)

PNPM 9 via Corepack

corepack enable
corepack prepare pnpm@9 --activate


Docker + Docker Compose

PostgreSQL 15/16

Playwright browsers

pnpm exec playwright install --with-deps

Optional

k6 for load testing

Environment Configuration

Create .env files where needed (root, services/api-gateway, etc).

API Gateway startup requirements (hard-fail if missing):

CORS_ALLOWED_ORIGINS must be set (comma-separated).

KMS keyset must be present or API refuses to start.

Example .env:
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

KMS Keying

Store dev keys in artifacts/kms/*.json (ignored in git).

Rotate keys:

pnpm security:rotate-keys --write-env .env

Quickstart (Local)
pnpm i --frozen-lockfile
pnpm -r build
docker compose up -d
pnpm -w exec prisma migrate deploy
pnpm --filter @apgms/api-gateway dev


API runs on http://localhost:3000
.

Smoke test
curl -sf http://localhost:3000/health
curl -sf http://localhost:3000/ready
curl -sf http://localhost:3000/metrics

Idempotency (ATO-grade)

All mutating endpoints require:

Idempotency-Key: <uuid or ULID>


Behaviour:

First request stores response in immutable log.

Replays return the exact same payload plus:

Idempotent-Replay: true


Reuse with different payload, org, or actor →
409 idempotency_conflict

Persist keys across retries.

Quality & Security Gates

These replicate CI locally. Run before pushing.

Type Safety
pnpm -r typecheck

Unit tests + coverage gate (>= 85%)
pnpm -r test -- --coverage
node ./scripts/check-coverage.mjs

Dependency SCA
pnpm audit --audit-level=high

Secret scanning
./gitleaks detect --no-color --redact --exit-code 1

SBOM generation
pnpm sbom        # output sbom.json

Schema drift
pnpm -w exec prisma migrate status

Merge-conflict guard
git grep -n '<<<<<<<\|=======\|>>>>>>>' -- ':!*.lock'

Accessibility & Performance
WCAG Smoke
pnpm -w exec playwright test webapp/tests/a11y.spec.ts

Axe per-route
pnpm --filter @apgms/webapp test:axe

(Optional) Lighthouse
pnpm -w exec lhci autorun --config=./lighthouserc.json

Operational Smoke Tests

Once API is running:

pnpm k6:smoke -- --env BASE_URL=http://localhost:3000

Release Compliance Workflow

A typical evidence bundle:

STAMP=$(date +%Y-%m-%dT%H%M%S)
OUT=artifacts/compliance/$STAMP && mkdir -p "$OUT"

pnpm -r test -- --coverage && cp -r coverage "$OUT/coverage"
node ./scripts/check-coverage.mjs 2>&1 | tee "$OUT/coverage_gate.txt"

pnpm audit --audit-level=high 2>&1 | tee "$OUT/sca.txt"
./gitleaks detect --no-color --redact --exit-code 1 2>&1 | tee "$OUT/gitleaks.txt" || true

pnpm sbom && mv sbom.json "$OUT/sbom.json"

pnpm -w exec prisma migrate status 2>&1 | tee "$OUT/prisma_status.txt"

curl -sSf http://localhost:3000/ready -o "$OUT/ready.json"
curl -sSf http://localhost:3000/metrics -o "$OUT/metrics.prom" || true

Pushing Changes
git checkout -b hardening/compliance-5-2
git add -A
git commit -m "docs(readme): align local workflow with 5.2 compliance gates"
git push -u origin hardening/compliance-5-2