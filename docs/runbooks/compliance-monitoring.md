# Compliance Monitoring and Dashboard Runbook

This runbook notes the safeguards that surround the designated one-way accounts, the payroll/POS ingestion paths, and the alerting/penalty flows that support the APGMS vision.

## Data Ingestion & Reconciliation
- The ingestion helpers (`shared/src/ledger/ingest.ts`) capture payroll contributions and POS transactions into the `PayrollContribution` and `PosTransaction` tables. They rely on the shared idempotency guard so duplicate submissions (from retries or manual overrides) cannot be replayed.
- The nightly `worker/src/jobs/designated-reconciliation.ts` job applies pending contributions to the `PAYGW_BUFFER` and `GST_BUFFER` ledgers before BAS lodgment, then validates the balances against the latest `BasCycle` obligations through `ensureDesignatedAccountCoverage`. If the buffers do not cover the required funds, the job raises a `DESIGNATED_FUNDS_SHORTFALL` alert and does not proceed with the transfer artefact until the discrepancy is resolved.
- `services/api-gateway/test/compliance.flow.spec.ts` replays the canonical fixtures stored at `artifacts/compliance/fixtures/pilot-workload.json`. Run it with `pnpm exec tsx services/api-gateway/test/run.ts` to prove the ingest → ledger → precheck → transfer path: the test loads the JSON fixture, ingests the payroll/POS batches, observes the shortfall block, then applies the pending contributions until `/compliance/transfer` would succeed. This doubles as documentation for the transfer blocking → alert resolution → retry loop that auditors expect to see.

## Alert/Ticket Handling
1. When the shortfall alert appears, check the dashboard for missing contributions and reconcile the relevant payroll or POS ingestion records. Investigate whether the business replayed the same data, missed a payroll run, or forwarded incomplete POS batches.
2. If data is missing, re-ingest the batch via the ingestion helpers, ensure the contributions appear in the ledger tables, and rerun the reconciliation worker so the contributions are applied before BAS lodgment.
3. If the business is still short, log the shortfall in the dashboard, notify Finance/Tax Ops of the potential penalty or interest, and open a remediation ticket in the incident tracker so ATO-facing teams can surface the issue to the customer.
- The fixtures + test above prove this remediation path. When you respond to an alert in production, capture the request/response payloads plus the evidence JSON written to `artifacts/compliance/pilot-report-*.json`, then mark the alert resolved via `/compliance/alerts/:id/resolve` with a note referencing the stored file.

## Transfer Blocking, Webhooks & Retry Loop
- `/compliance/transfer` now enforces a step-up MFA check via `requireRecentVerification`. Operators must call `/auth/mfa/step-up`, enter their TOTP/backup code, then POST the transfer within 10 minutes. Requests that lack an MFA session receive `403 mfa_required` and should be reattempted only after re-verification.
- `ensureDesignatedAccountCoverage` continues to raise `DESIGNATED_FUNDS_SHORTFALL` alerts and locks the offending account until a controller resolves the discrepancy. After triage, call `/compliance/alerts/:id/resolve` with the remediation note so the audit trail links back to the pilot evidence.
- Banking partners can send settlement notifications to `/compliance/partner-webhook`. Authenticate with `PARTNER_WEBHOOK_TOKEN` and include partner IDs in the headers; the route stores a JSONL row in `artifacts/compliance/partner-webhook-events.jsonl` (headers redacted) and emits `partner.webhook.received` security logs for your SIEM.

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

## Phase 3 Partnering & Pilots
- Swap in a sandboxed ADI/banking adapter by setting `DESIGNATED_BANKING_URL`, `DESIGNATED_BANKING_TOKEN`, and (optionally) `DESIGNATED_BANKING_CERT_FINGERPRINT`. On first run the `/compliance/transfer` route writes `artifacts/compliance/partner-info.json` so the pilot evidence always contains the partner URL, DSP product ID, and certificate fingerprint used for that session.
- `/compliance/status` and `/compliance/pilot-status` expose the partner metadata plus the DSP product ID pulled from `DSP_PRODUCT_ID`. The pilot endpoint reads the JSON drops in `artifacts/compliance/pilot-report-*.json` (two mock examples ship in `pilot-report-alpha.json` and `pilot-report-beta.json`) and summarizes payloads, reminders, alerts, and transfer receipts for auditors.
- `/compliance/reconciliation` ties together the latest `BasCycle`, the totals from `DesignatedTransfer`, and the partner confirmations stored in `artifacts/compliance/partner-confirmations.json`. Share this output with auditors so they can trace DesignatedTransfer totals → BasCycle requirements → sandbox confirmation references (`DSP-TPG-REF-*`).
- Capture the ATO DSP Product ID, OSF questionnaire reference, STP/BAS entitlement, and any AUSTRAC/ASIC/AFSL updates in `docs/runbooks/admin-controls.md` and the compliance dashboard so auditors can confirm your regulatory posture.
- Run pilots for at least two orgs (real or virtual): ingest payroll/POS batches through `/ingest/*`, perform `/compliance/precheck`, execute `/compliance/transfer`, and track alerts/resolutions via `/compliance/status` and `/compliance/reminders`. Log the pilot outputs (payloads, transfer receipts, reminder states) in `artifacts/compliance/` to demonstrate the entire ingest -> ledger -> precheck -> transfer -> alert loop. Reference those files via `/compliance/pilot-status` when presenting to stakeholders.

## Phase 4 Innovation Stretch
- Use `/compliance/status`’s new `forecast` payload and `tierStatus` (reserve/automate/escalate) to show “virtual balances” vs. forecasted obligations inside the compliance dashboard. Tie those metrics into alerts to warn operations when tier escalates to `escalate` before BAS lodgment.
- Start a lightweight prediction job (`forecastObligations`, `computeTierStatus` in `shared/src/ledger/predictive.ts`) to recompute obligations ahead of each BAS cycle. Each run now emits model diagnostics (EWMA alpha, regression slope, anomaly thresholds) and records them in `artifacts/compliance/tier-state/snapshots/*.json` while the time-series snapshots land in `artifacts/compliance/tier-history/`. These files document how the heuristics evolve so you can promote them to a formal ML signal later.
- Keep linking each predictive alert to audit evidence in `artifacts/compliance/`; note how ML/tiered signals are tuned (even if heuristics) so future reviewers can evolve this into a true ML signal if you choose later.
- Schedule `/compliance/tier-check` as a cron job (or webhook) so the system recalculates forecasts/tier statuses regularly. When a tier flips to `escalate`, the route now creates a `TIER_ESCALATION` alert, writes the tier state, and logs it as a security event; store the resulting `artifacts/compliance/tier-state/<org>.json` plus the alert JSON as onboarding evidence for the ATO IR. Customize the cron frequency to match BAS cycles (e.g., daily or 6h) and add the command `curl -X POST http://localhost:3000/compliance/tier-check` to your scheduler notes.
- When a tier escalates, the webhook defined via `TIER_ESCALATION_WEBHOOK_URL` and optional `TIER_ESCALATION_WEBHOOK_TOKEN` sends the alert metadata (orgId, alertId, tier map, diagnostics) to Slack/email. Every delivery attempt is logged to `artifacts/compliance/tier-webhook-log.jsonl` so on-call teams can prove that escalation notifications fired.

## Regulatory & Partner Evidence
- Store the DSP OSF questionnaire export and product metadata in `artifacts/compliance/dsp-osf-registration.json` and link it from `artifacts/compliance/regulatory-status.json`. This file also tracks AUSTRAC/ASIC/AFSL readiness, the sandbox contract reference, and the next reviewer/owner.
- Update `docs/runbooks/admin-controls.md` whenever the regulatory JSON changes. The admin runbook now references the same artifact so regulators can trace from checklist → evidence file.
- Keep `artifacts/compliance/partner-info.json` in sync with the sandbox credentials, DSP product ID, and certificate fingerprints you used for each pilot. When stakeholders are ready to connect a live sandbox ADI, populate `DESIGNATED_BANKING_URL`, `DESIGNATED_BANKING_TOKEN`, and `DESIGNATED_BANKING_CERT_FINGERPRINT`, hit `/compliance/status`, and attach the refreshed JSON to your pilot evidence pack.
