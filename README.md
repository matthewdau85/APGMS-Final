# APGMS – Automated PAYGW & GST Management System

**Status:** Prototype • AU-only • Designed for alignment with ATO DSP Operational Security Framework (OSF) principles  
**Scope:** PAYGW, GST, BAS automation • one-way designated accounts • regulator view • audit guarantees

APGMS is an Australian-only platform aimed at hardened management of PAYGW and GST liabilities, including:

- Automated PAYGW/GST calculation using versioned configuration tables (no hardcoded AU rates/thresholds)
- Designated one-way account policy (PAYGW/GST cannot be misused as operating cash)
- Auditability primitives: deterministic outcomes, shortfall tracking/reconciliation patterns, and idempotency keys on write paths
- Regulator-style views/APIs (prototype routes are **non-shippable in production**)
- Sensitive identifier crypto scaffolding (envelope-encryption approach; production key management hardening required)

See docs/runbooks/ato-rules-maintenance.md for living guidance on the ATO ruleset.
It covers adding new tax years and PAYGW/GST scenario/table keys.
Run `pnpm validate:ato` after each change to confirm manifests and placeholder data.
The section is written for operators and DeveloperOperator audiences.
Link: [ATO rules runbook](docs/runbooks/ato-rules-maintenance.md)

---

## Monorepo Structure

```text
APGMS-Final/
├── services/
│   ├── api-gateway/      # Fastify API gateway, auth, security headers, prototype regulator routes, /metrics
│   └── connectors/       # Bank/ATO provider scaffolding (mock + real)
├── packages/
│   ├── domain-policy/    # AU tax engines, designated account policy, rules, deterministic outcomes
│   └── ledger/           # Double-entry ledger engine, journaling & tests
├── shared/               # Prisma schema/client + shared utilities (crypto/redaction/etc.)
├── apps/
│   └── phase1-demo/      # UI demo for Phase 1 flows
├── webapp/               # Main UI (React/Vite)
├── worker/               # Background jobs (parameter updates, projections)
└── artifacts/            # Evidence bundles + dev key material (gitignored except .gitkeep)



---

## CI & Security Gates (GitHub Actions)

This repo ships with two workflows under `.github/workflows/`:

### CI (`ci.yml`)
Runs on every PR/push:

- `./scripts/verify.sh` (workspace build + typecheck + unit/integration tests)
- Playwright a11y smoke:
  - starts the Vite webapp on `http://127.0.0.1:5173`
  - runs: `pnpm -w exec playwright test webapp/tests/a11y.spec.ts`

### Security (`security.yml`)
Runs on PR/push + scheduled weekly:

- Merge-conflict marker guard (`git grep '<<<<<<<|=======|>>>>>>>'`)
- Dependency SCA: `pnpm audit --audit-level=high`
- Secret scanning: Gitleaks (fails CI on findings)
- SBOM generation: CycloneDX (uploads `sbom.json` artifact)
- Trivy filesystem scan (fails on HIGH/CRITICAL)

To run the same checks locally:

```bash
./scripts/verify.sh
pnpm exec playwright install --with-deps
pnpm --filter @apgms/webapp dev -- --host 127.0.0.1 --port 5173 --strictPort
pnpm -w exec playwright test webapp/tests/a11y.spec.ts
pnpm audit --audit-level=high
