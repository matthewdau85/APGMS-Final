# APGMS – Automated PAYGW & GST Management System

**Status:** Prototype • AU-only • Designed for alignment with ATO DSP Operational Security Framework (OSF) principles  
**Scope:** PAYGW, GST, BAS automation • one-way designated accounts • regulator view • audit guarantees

APGMS is an Australian-only platform aimed at hardened management of PAYGW and GST liabilities, including:

- Automated PAYGW/GST calculation using versioned configuration tables (no hardcoded AU rates/thresholds)
- Designated one-way account policy (PAYGW/GST cannot be misused as operating cash)
- Auditability primitives: deterministic outcomes, shortfall tracking/reconciliation patterns, and idempotency keys on write paths
- Regulator-style views/APIs (prototype routes are **non-shippable in production**)
- Sensitive identifier crypto scaffolding (envelope-encryption approach; production key management hardening required)

See `docs/runbooks/ato-rules-maintenance.md` for living guidance on:
- Adding a new tax year / effective-date window.
- Extending PAYGW/GST scenarios or table keys.
- Importing ATO tables and keeping `data/ato/v1` placeholders aligned.
- Running `pnpm validate:ato` after each edit (root script).
- Communicating updates to operators and DeveloperOperator stakeholders.
Link: [ATO rules runbook](docs/runbooks/ato-rules-maintenance.md)

---

## Security scan reminders

- SBOM generation (`pnpm run sbom`) now works because `glob` is pinned to v7.x; regenerate `sbom.xml` after workspace dependency changes.
- Secret scanning (`pnpm run gitleaks`) uses the current CLI (`gitleaks detect --redact --exit-code 1`); rerun before merging to ensure no credentials leak.
- Trivy (`pnpm run trivy`) performs filesystem vuln+secret scans; rerun after dependency updates.
- Supply-chain auditing (`pnpm sca`) executes `pnpm audit --audit-level=high`; treat it as part of the security scan bundle.
- Known audit findings (TODO): `qs@6.14.0` (pulled via `supertest`) and `@remix-run/router@1.23.0` (`react-router-dom`). Upgrade/override when upstream patches land. Document the outstanding findings so the team can revisit once the vulnerable ranges are patched upstream.

## Readiness & security chain

- `pnpm readiness:chain` now runs the staged workflow recorded in `scripts/readiness/run-readiness-chain.sh`:
  1. `pnpm run sbom`
  2. `pnpm run gitleaks`
  3. `pnpm run trivy`
  4. `pnpm validate:ato`
  5. `pnpm run test:a11y`
  6. `bash scripts/run-all-tests.sh` (or the closest run-all entry in your repo tree)
- Each stage emits logs to `artifacts/readiness-logs/<timestamp>/<stage>.log`; rerun `pnpm readiness:chain -- --from <stage>` to resume from a specific point, or `pnpm readiness:chain -- --list` to see the stage names.
- `pnpm readiness:all` (global readiness) runs `scripts/readiness/all.cjs`, which now waits for `/ready` to return 200 before failing so the availability pillar can survive transient 503 responses while the gateway warms up. The per-stage readiness logs live in `artifacts/readiness-logs/<timestamp>/`.
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

