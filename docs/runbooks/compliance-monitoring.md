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
  * Pending contributions (count per org, last ingestion timestamp, ingestion source). Use `/compliance/status` and `/compliance/pending` to populate these views.
  * Alerts (shortfall and violation IDs, severity, outstanding actions) pulled from the `DESIGNATED_FUNDS_SHORTFALL` alerts recorded by `ensureDesignatedAccountCoverage`.
  * Penalties/Remissions (status, documentation links, next expected BAS).
  * Payment-plan discussions (current status, ratio of outstanding obligations to buffer balance).
- Link each card to the relevant audit log entries produced by the enforced `applyDesignatedAccountTransfer`/`logSecurityEvent` pipeline so you can arm security/compliance teams with evidence during reviews.

## Phase 1 Callouts
- The compliance monitor API exposes `/ingest/payroll`, `/ingest/pos`, `/compliance/precheck`, `/compliance/pending`, and `/compliance/status`. Use these endpoints to feed payroll/POS webhooks (include Idempotency-Key headers), validate balances before BAS lodgment, and surface pending contributions plus remediation hints.
- The `configureBankingAdapter` hook in `shared/src/ledger/designated-account.ts` lets you swap in a sandbox ADI/banking partner adapter later. For now the Prisma adapter reports deposit-only balances and logs shortfalls; document when you replace it with a real banking integration (include adapter name, endpoint, and required certificates in `status/` or `artifacts/compliance/`).

## Phase 2 Readiness
- The BAS precheck route (`/compliance/precheck`) now compares buffers with the current `BasCycle` and rejects transfers with shortfall alerts (response `status: shortfall`). Use the response’s `pendingContributions` and `remediation` guidance before retrying. When the alert is resolved, mark it through `/compliance/alerts/:id/resolve` and include the resolution proof inside `artifacts/compliance/`.
- `/compliance/reminders` surfaces upcoming BAS cycles (due in days, status), so operations teams can schedule reminders and understand whether a payment plan is already in place. Cite these endpoints when discussing remedial notifications in your compliance dashboard.
- Document your ATO DSP application timeline, OSF questionnaire status, product IDs, and any AUSTRAC/ASIC/AFSL discussions on `docs/runbooks/admin-controls.md` (or a dedicated status file) so referees can see evidence of regulatory preparation. Keep scanned copies in `artifacts/compliance/` alongside the alert/remediation records for audit verifiers.

## Regulatory Path & DSP Readiness
- Track the ATO DSP application (OSF questionnaire, product registration, STP/BAS entitlement) in parallel with this code work. Log the submitted product ID, scope of services, and the readiness checklist inside this runbook so audits can see the progress. Document whether you plan to act as a software-only adviser (no fund movement) or to layer onto a licensed banking partner or restricted ADI.
- Before any real fund movement: confirm whether AFSL/ADI/ASIC/AUSTRAC registration is required, engage legal counsel, and note the chosen path in the repository with the key dates/status. Maintain an evidence folder (`artifacts/compliance/`) that captures the OSF questionnaire export plus any banking partner contracts so you can prove compliance during reviews.

-## Phase 3 Partnering & Pilots
- Swap in a sandboxed ADI/banking adapter by setting `DESIGNATED_BANKING_URL`/`DESIGNATED_BANKING_TOKEN` or calling `configureBankingAdapter` (see `shared/src/ledger/designated-account.ts`). Log the partner endpoint, token lifecycle, and certificate fingerprint inside `artifacts/compliance/` so auditors can verify the financial integration at claim time.
- Capture the ATO DSP Product ID, OSF questionnaire reference, STP/BAS entitlement, and any AUSTRAC/ASIC/AFSL updates in `status/` or `docs/runbooks/admin-controls.md`. Maintain a checklist that mirror the DSP Operational Security Framework readiness criteria and link each item back to the compliance dashboard (e.g., note which compliance status entry corresponds to the Product ID used during pilot).
- Run pilots with at least two orgs (real or “virtual”): ingest payroll/POS batches via `/ingest/*`, perform `/compliance/precheck`, and track the alerts + resolutions via `/compliance/status` and `/compliance/reminders`. Store the pilot summary (org IDs, payload traces, shortfall responses, resolution timestamps) in `artifacts/compliance/` along with the reminder outputs so you can demonstrate the full vertical slice from ingest → ledger → precheck → transfer/alert.
 
## Phase 4 Innovation Stretch
- Use `/compliance/status`’s new `forecast` payload and `tierStatus` (reserve/automate/escalate) to show “virtual balances” vs. forecasted obligations inside the compliance dashboard. Tie those metrics into alerts to warn operations when tier escalates to `escalate` before BAS lodgment.
- Start a lightweight prediction job (`forecastObligations`, `computeTierStatus` in `shared/src/ledger/predictive.ts`) to recompute obligations ahead of each BAS cycle. Feed the forecast into future alerts and call out the tier name on reminders/pending endpoints so you can surface unusual shortfalls and respond before deadlines.
- Keep linking each predictive alert to audit evidence in `artifacts/compliance/`; note how ML/tiered signals are tuned (even if heuristics) so future reviewers can evolve this into a true ML signal if you choose later.
