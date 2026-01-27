# DSP / OSF Evidence Index (APGMS)

Version: 0.2
Evidence snapshot commit: 8722b00 (working tree)
Last updated: 2026-01-27
Owner: APGMS Team

## Purpose

This index maps DSP Operational Security Framework (OSF)-aligned obligations to concrete evidence artefacts in the repository (code, tests, scripts, and runbooks). The intent is that a regulator, auditor, partner, or investor can follow links and verify implementation and operational discipline.

Terminology:
- Implemented: evidence exists and is demonstrable.
- In progress: partial implementation; gaps documented.
- Planned: intended control; evidence not yet present.

## Evidence cross-references

- ADR-001 -> EV-001 (`docs/evidence/EV-001-platform-architecture.md`)
- ADR-004 -> EV-012 (`docs/evidence/EV-012-ledger-integrity-testing.md`)
- EV-012 / EV-013 are indexed here for DSP OSF review

## How to assemble an evidence pack (combined-code-export)

The repo already contains evidence collection and export scripts. For a regulator/partner snapshot, generate all of the following from a tagged commit:

1) Evidence collection:
- `pnpm compliance:evidence` -> `scripts/collect-evidence.mjs`

2) Evidence pack export:
- `pnpm backup:evidence-pack` -> `scripts/export-evidence-pack.ts`

3) Readiness suite:
- `pnpm readiness:all` -> `scripts/readiness/all.cjs`
  - `readiness:availability` -> `scripts/readiness/availability.cjs`
  - `readiness:availability-and-performance` -> `scripts/readiness/availability-and-performance.cjs`
  - `readiness:k6` -> `scripts/readiness/k6-summary.cjs`
  - `readiness:log-scan` -> `scripts/readiness/log-scan.cjs`

4) Security scans:
- `pnpm scan:secrets` / `pnpm gitleaks`
- `pnpm scan:fs` / `pnpm trivy`
- `pnpm sbom` and/or `pnpm sbom:deps`
- `pnpm sca` / `pnpm audit:prod`

Recommended evidence folder layout:
- `evidence/combined-code-export/<YYYY-MM-DD>/<GIT_SHA>/`
  - `code/` (selected snapshot)
  - `tests/` (test output + coverage where applicable)
  - `readiness/` (readiness suite outputs)
  - `scans/` (gitleaks/trivy/SBOM outputs)
  - `docs/` (rendered docs)

## OSF obligation mapping

### 1) Governance, control ownership, documented framework

Control summary:
- Documented DSP/OSF skeleton and checklists.
- Runbooks and incident templates exist to standardize operations.

Evidence:
- `docs/compliance/dsp-operational-framework.md`
- `docs/compliance/checklist.md`
- `docs/ops/runbook.md`
- `status/incidents/_template.md`
- `status/incidents/incident-template.md`
- `scripts/readiness/open-incident.cjs` (incident artifact creation)

Verification:
- Confirm documents define roles, response posture, and decision points.
- Create a new incident entry using the open-incident script.

Status: Implemented (skeleton + usable templates), In progress (needs tighter linkage to controls below)

---

### 2) Security logging and auditability

Control summary:
- Central audit/event capability exists and is intended to be used by security-relevant flows.
- Commit/change traceability is supported via an audit artifact.

Evidence:
- `services/api-gateway/src/lib/audit.ts`
- `services/api-gateway/src/lib/audit.d.ts`
- `services/audit/src/index.ts`
- `services/audit/src/index.js`
- `artifacts/commit_audit.csv` (change traceability artifact)

Verification:
- Review audit/event module interfaces.
- Demonstrate one end-to-end flow producing an auditable event (recommended next: service mode updates, settlement lifecycle transitions).
- Confirm commit audit output is generated/maintained by your process.

Status: In progress

Gaps / next actions:
- Add explicit tests asserting required audit fields (timestamp, actor, action, outcome, correlation id).
- Ensure privileged operations (admin mode flip, key rotation) produce audit events by default.

---

### 3) Availability, readiness, and operational gating

Control summary:
- Readiness scripts exist and can be run as a unified suite.
- Health and readiness endpoints exist in the gateway.
- Incident-safe “service mode” exists to suspend or enforce read-only during a RED incident.

Evidence:
- `scripts/readiness/*.cjs`
- `services/api-gateway/src/app.ts` (health/ready and routing)
- `services/api-gateway/src/service-mode.ts`
- `services/api-gateway/src/guards/service-mode.ts`
- `services/api-gateway/src/routes/admin-service-mode.ts`
- Incident record example: `status/incidents/20251210T073639Z-readiness-all.md`

Verification:
- Run `pnpm readiness:all` and preserve output in evidence pack.
- Flip service mode to `suspended` and confirm write endpoints respond 503.
- Flip service mode to `read-only` and confirm writes respond 409 while reads remain functional.

Status: Implemented (single-instance). In progress (multi-instance consistency)

Gaps / next actions:
- Persist service mode in a shared store (Redis/DB) for multi-instance deployments.
- Explicitly document “maintenance window” handling in SLO calculations.

---

### 4) Monitoring, metrics, dashboards, and alerting

Control summary:
- Metrics and tracing modules exist.
- Ops docs exist for dashboards, alerting, and PromQL guidance.

Evidence:
- `services/api-gateway/src/observability/metrics.ts`
- `services/api-gateway/src/observability/tracing.ts`
- `services/api-gateway/src/observability/prisma-metrics.ts`
- `shared/src/observability/compliance-health.ts`
- `infra/observability/grafana/dashboards.json`
- `docs/ops/dashboards.md`
- `docs/ops/alerts.md`
- `docs/ops/promql.md`
- `docs/ops/logging.md`
- UI compliance dashboard wiring (Figma-derived shell in live router):
  - `webapp/src/app/App.tsx` (live route tree)
  - `webapp/src/app/figma/FigmaProvidersLayout.tsx` (providers + Layout + Outlet)
  - `webapp/src/_figma/app/components/Layout.tsx` (sidebar + top shell)
  - `webapp/src/_figma/app/pages/Dashboard.tsx` (dashboard view)
  - `webapp/src/_figma/app/pages/Obligations.tsx` (obligations view)
  - `webapp/src/_figma/app/pages/Reconciliation.tsx` (reconciliation view)
  - `webapp/src/_figma/app/pages/EvidencePacks.tsx` (evidence packs view)
  - `webapp/src/_figma/app/pages/BAS.tsx` (BAS view)

Verification:
- Confirm metrics are emitted for HTTP requests and DB instrumentation.
- Confirm dashboards exist and align to SLOs in `docs/ops/slo.md`.
- Confirm alert thresholds are defined and actionable.

Status: In progress

Gaps / next actions:
- Ensure alert rules are codified (not only documented).
- Tie each SLO to an explicit query + alert threshold in `docs/ops/alerts.md`.

---

### 5) Data integrity (schema, migrations, correctness)

Control summary:
- Schema is managed via Prisma and migrations are present and versioned.
- Migration status scripts exist.

Evidence:
- `shared/prisma/migrations/**`
- `package.json` scripts:
  - `db:migrate`, `db:deploy`, `migrate:status`, `prisma:status`
- Domain runbooks (integrity scenarios):
  - `packages/domain-policy/docs/runbooks/runbook-bas-mismatch.md`

Verification:
- Run `pnpm migrate:status` against target environments.
- Review migration sequence and confirm it matches domain requirements.
- Confirm validation exists on boundary routes (Fastify schemas).

Status: Implemented (migration discipline), In progress (backup/restore proof)

Gaps / next actions:
- Add explicit backup/restore runbook and a periodic restore verification step.
- Add integrity tests covering “mismatch” runbook scenarios.

---

### 6) Backup, evidence retention, and recovery

Control summary:
- Evidence export is implemented as a script.
- Key rotation script exists (PII/crypto hygiene).
- Backup for DB itself is not yet fully documented as a repeatable runbook.

Evidence:
- `scripts/export-evidence-pack.ts`
- `scripts/rotate-pii-keys.mjs` (invoked by `pnpm security:rotate-keys`)
- `docs/runbooks/secrets-management.md`

Verification:
- Generate an evidence pack and confirm it includes tests/readiness/scans/docs.
- Demonstrate key rotation is controlled and documented (non-production rehearsal recommended).

Status: In progress

Gaps / next actions:
- Create a DB backup/restore runbook (frequency, retention, encryption, access).
- Add recovery drill schedule and acceptance criteria.

---

### 7) Secure development and vulnerability management

Control summary:
- SCA, secret scanning, filesystem scanning, and SBOM tooling are present as first-class scripts.

Evidence:
- `package.json` scripts:
  - `scan:secrets`, `gitleaks`, `scan:fs`, `trivy`
  - `sbom`, `sbom:deps`, `check:sbom`
  - `sca`, `audit:prod`, `audit:dev`
- `scripts/check-sbom.mjs`

Verification:
- Run scans in CI and store outputs in the evidence pack.
- Track remediation decisions and timelines (recommended: add a security register document).

Status: Implemented (tooling), In progress (governance around findings)

---

### 8) Access control and privileged operations

Control summary:
- API secure scope uses auth guard.
- Admin service-mode endpoint is token-guarded and fails closed if not configured.

Evidence:
- `services/api-gateway/src/auth.ts`
- `services/api-gateway/src/routes/admin-service-mode.ts`
