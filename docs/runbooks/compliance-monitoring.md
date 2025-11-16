# Compliance Monitoring and Dashboard Runbook

This runbook notes the safeguards that surround the designated one-way accounts, the payroll/POS ingestion paths, and the alerting/penalty flows that support the APGMS vision.

## Data Ingestion & Reconciliation
- The ingestion helpers (`shared/src/ledger/ingest.ts`) capture payroll contributions and POS transactions into the `PayrollContribution` and `PosTransaction` tables. They rely on the shared idempotency guard so duplicate submissions (from retries or manual overrides) cannot be replayed.
- The nightly `worker/src/jobs/designated-reconciliation.ts` job applies pending contributions to the `PAYGW_BUFFER` and `GST_BUFFER` ledgers before BAS lodgment, then validates the balances against the latest `BasCycle` obligations through `ensureDesignatedAccountCoverage`. If the buffers do not cover the required funds, the job raises a `DESIGNATED_FUNDS_SHORTFALL` alert and does not proceed with the transfer artefact until the discrepancy is resolved.

## Alert/Ticket Handling
1. When the shortfall alert appears, check the dashboard for missing contributions and reconcile the relevant payroll or POS ingestion records. Investigate whether the business replayed the same data, missed a payroll run, or forwarded incomplete POS batches.
2. If data is missing, re-ingest the batch via the ingestion helpers, ensure the contributions appear in the ledger tables, and rerun the reconciliation worker so the contributions are applied before BAS lodgment.
3. If the business is still short, log the shortfall in the dashboard, notify Finance/Tax Ops of the potential penalty or interest, and open a remediation ticket in the incident tracker so ATO-facing teams can surface the issue to the customer.

## Penalty & Remission Workflow
- The dashboard exposes recent penalties/interest notices that can accrue when BAS lodgments fail to fire. For large shortfalls, document the timeline, evidence of calculation corrections, and any communications with the business in the audit log.
- Once the business provides proof of compliance/proactive remediation, update the dashboard status to `remission_requested` and attach study evidence (contributions logs, updated `DesignatedTransfer` entries, alerts resolved). This metadata is used to support penalty remission requests or payment-plan negotiations.
- After the ATO approves a remission, update the dashboard entry to `remission_verified`, include the official reference number, and note any follow-up reminders (e.g., verifying the next BAS posted the funds on time).

## Dashboard Signals
- Surface the following cards on the compliance dashboard:
  * Pending contributions (count per org, last ingestion timestamp, ingestion source).
  * Alerts (shortfall and violation IDs, severity, outstanding actions).
  * Penalties/Remissions (status, documentation links, next expected BAS).
  * Payment-plan discussions (current status, ratio of outstanding obligations to buffer balance).
- Link each card to the relevant audit log entries produced by the enforced `applyDesignatedAccountTransfer`/`logSecurityEvent` pipeline so you can arm security/compliance teams with evidence during reviews.

## Regulatory Path & DSP Readiness
- Track the ATO DSP application (OSF questionnaire, product registration, STP/BAS entitlement) in parallel with this code work. Log the submitted product ID, scope of services, and the readiness checklist inside this runbook so audits can see the progress. Document whether you plan to act as a software-only adviser (no fund movement) or to layer onto a licensed banking partner or restricted ADI.
- Before any real fund movement: confirm whether AFSL/ADI/ASIC/AUSTRAC registration is required, engage legal counsel, and note the chosen path in the repository with the key dates/status. Maintain an evidence folder (`artifacts/compliance/`) that captures the OSF questionnaire export plus any banking partner contracts so you can prove compliance during reviews.
