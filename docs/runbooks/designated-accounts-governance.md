# Designated Accounts Governance Runbook

## Purpose
Keep the designated accounts controls at a "5/5" confidence level by exercising automated checks, manual reviews, and stakeholder retrospectives across the three pillars.

## Checks
1. **Provider abstraction** – Verify `providers/banking/base.ts` logs `banking-provider: credit attempt` and `banking-provider: credit approaching cap` events; raise an alert if a provider exceeds 90% of `maxWriteCents` more than once per hour.
2. **Policy engine** – Search the audit timeline for `DESIGNATED_WITHDRAWAL_ATTEMPT` alerts with metadata (orgId, violation) and ensure each entry contains the message “Designated accounts are deposit-only; debits are prohibited”.
3. **Reconciliation artefact** – Run `pnpm --filter worker exec node scripts/verify-designated-reconciliation.mjs` nightly (or via CI) to confirm a `designated-reconciliation` artefact exists in the last 24 hours; the script outputs the latest `artifactId` and SHA-256 for auditors.

## Runbook Steps
1. Launch the nightly worker via Docker Compose: `docker compose up worker` (after running `docker compose build --no-cache worker` when dependencies change). Watch the logs for `designated-account-reconciliation:*` info, warn, and error lines.
2. Open the evidence center (`webapp/src/RegulatorEvidencePage.tsx`) to retrieve the latest `designated-reconciliation` entry, inspect the `wormUri`, and click **Verify** to confirm the stored SHA-256 matches the hash you recompute.
3. `.github/workflows/verify-designated-reconciliation.yml` executes `scripts/verify-designated-reconciliation.mjs` nightly; log the outcome in the governance channel (include the `artifactId` + hash) so the team knows whether the artefact creation succeeded and any mitigation steps.

## Retrospective Cadence
Schedule quarterly reviews with compliance, operations, and engineering to:

- Review alert counts (`DESIGNATED_WITHDRAWAL_ATTEMPT`, cap warnings).
- Inspect worker run metrics (processed orgs, success/failure counts, durations).
- Confirm the artefact verification script runs succeeded and document any remediation steps.

Document outcomes in this runbook and revisit `docs/compliance/designated-accounts.md` whenever new lessons arise so the compliance story stays aligned with the living architecture.

## Admin Control Logging
For events that manipulate PII (user deletion/export), refer to `docs/runbooks/admin-controls.md` to confirm the `security_event` stream includes `event`, `orgId`, `principal`, `subjectEmail`/`subjectUserId`, and the `x-correlation-id` header or Fastify `request.id`. That runbook explains how to trace those entries alongside the audit log chain and enforce fresh correlation IDs before regulators. 
