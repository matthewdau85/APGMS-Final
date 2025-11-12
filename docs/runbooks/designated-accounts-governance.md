# Designated Accounts Governance Runbook

## Purpose
Keep the designated accounts controls at a “5/5” confidence level by exercising automated checks, manual reviews, and stakeholder retrospectives across the three pillars.

## Checks
1. **Provider abstraction** – Verify `providers/banking/base.ts` logs `banking-provider: credit attempt` and `banking-provider: credit approaching cap` events; alert if a provider spikes above 90% of `maxWriteCents` more than once per hour.
2. **Policy engine** – Search the audit timeline for `DESIGNATED_WITHDRAWAL_ATTEMPT` alerts with metadata (orgId, violation) and ensure they contain the documented message “Designated accounts are deposit-only; debits are prohibited”.
3. **Reconciliation artefact** – Run `pnpm --filter worker exec node scripts/verify-designated-reconciliation.mjs` nightly (or from CI) to confirm a `designated-reconciliation` artefact exists in the last 24 hours; the script outputs the latest `artifactId` + SHA-256 for auditors.

## Runbook Steps
1. Launch the nightly worker via Docker Compose: `docker compose up worker` (after running `docker compose build --no-cache worker` when dependencies change). Watch the logs for `designated-account-reconciliation:*` info/warn/error lines.
2. Use `RegulatorEvidencePage.tsx` (webapp evidence center) to retrieve the latest `designated-reconciliation` entry, inspect the `wormUri`, and click **Verify** to confirm the SHA-256.
3. Trigger `scripts/verify-designated-reconciliation.mjs` during deployments or via a scheduler to automate the health check.

## Retrospective Cadence
Schedule quarterly reviews with compliance, operations, and engineering to:

- Review alert counts (`DESIGNATED_WITHDRAWAL_ATTEMPT`, cap warnings).
- Inspect worker run metrics (processed orgs, successes/failures, durations).
- Confirm artefact verification script runs succeeded and update remediation steps if failures occur.

Document outcomes in this runbook and revisit the compliance doc (`docs/compliance/designated-accounts.md`) when lessons learned generate new evidence.
