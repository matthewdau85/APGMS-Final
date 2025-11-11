# Manual Fallback Playbooks

When API integrations or automated workers are unavailable, operators can follow these
manual fallbacks to maintain ATO compliance and meet customer SLAs. This playbook links
back to the [operations runbook](../ops.md) and the [designated-account controls
runbook](../ndb.md) for additional context.

## 1. Manual BAS Lodgement

**Trigger:**
- `worker/ato-filer` reports `ato.bas.failed` audit events or misses the SLA defined in the
  [ops runbook](../ops.md#regulator-portal-checks).
- The connectors service flags repeated `banking_settlement_failed` or `payroll_submission_failed`
  responses.

**Goal:** Lodge the current BAS period within the regulatory SLA (ATO expects lodgement by
close of business on the statutory due date).

**Steps:**
1. Confirm latest reconciliation snapshot in the regulator portal or via
   `designated-reconciliation` evidence (hash verification procedure in
   [docs/compliance/designated-accounts.md](../../docs/compliance/designated-accounts.md)).
2. Export BAS figures from `BasPeriod` via the read-only SQL recipe documented in the
   [operations runbook](../ops.md) and cross-check against the latest
   `designatedReconciliationSnapshot` entry.
3. Log into the ATO Business Portal using the emergency credential pack. Follow the
   government UI prompts to lodge PAYGW and GST totals, referencing the artefact hash to
   ensure tamper evidence.
4. Record the manual lodgement in the immutable audit log by creating an
   `ato.bas.manual_lodge` entry using `scripts/collect-evidence.mjs --note` and attach the
   portal receipt.
5. Update `BasPeriod`:
   - `status = 'lodged'`
   - `lodgedAt = now()`
   - `lodgementAttempts += 1`
   - `lodgementLastAttemptAt = now()`
   - `evidenceId` pointing at the uploaded receipt artefact
6. Trigger a post-mortem per [ops.md](../ops.md#regulator-portal-checks) to restore
   automation and document any SLA breach.

**SLA References:**
- BAS lodgement must occur before the statutory due date. Use the `lodgementLastAttemptAt`
  column introduced in this change to prove compliance.

## 2. Deferred Remittance / Escrow Manual Release

**Trigger:**
- `worker/ato-filer` marks pay runs or BAS periods as `ESCROW_BLOCKED`, `ESCROW_DEFICIT`, or
  `escrow_blocked` in the database.
- Open `DesignatedViolationFlag` records exist (`status = 'OPEN'`).

**Goal:** Manually verify designated-account balances and, where safe, release funds or
resume filings without breaching escrow controls.

**Steps:**
1. Retrieve the latest `DesignatedReconciliationSnapshot` and confirm the SHA-256 hash matches
   the evidence artefact (`EvidenceArtifact.sha256`).
2. Review open violation flags via SQL: `SELECT * FROM "DesignatedViolationFlag" WHERE status = 'OPEN';`
   Log remediation notes in the audit trail before resolving.
3. If balances are sufficient and controls satisfied, update the affected
   `DesignatedAccountStateTransition` with a manual transition to `ACTIVE` and close the
   relevant violation flag (`resolvedAt = now()` plus supporting metadata).
4. Set `PayRun.stpReleaseAt = now()` for payroll items or `BasPeriod.releasedAt = now()` for
   BAS periods after manual approval. This re-enables the automated worker on the next run.
5. If balances remain insufficient, initiate customer comms using the template defined in
   [runbooks/ndb.md](../ndb.md) and schedule an escalation review with finance.

**SLA References:**
- Manual review must conclude within 1 business day of a block to uphold the escrow SLA
  tracked in `DesignatedViolationFlag`.
- Capture every decision in the audit log (`auditLog` + `AuditLogSeal`) to preserve the
  immutable evidence chain.

## 3. Payroll STP Manual Submission

**Trigger:**
- `worker/ato-filer` marks `PayRun.stpStatus = 'FAILED'` after maximum retries.
- Connectors service reports degraded OAuth or webhook validation for payroll adapters.

**Goal:** Lodge STP files via ATO Online services while maintaining escrow controls.

**Steps:**
1. Validate escrow coverage as described in the deferred remittance section. Do not proceed
   if balances are insufficient or violation flags remain open.
2. Export the STP payload using the payroll domain tooling (`node apps/payroll/export-stp.js`
   or manual SQL referencing the `PayRun` and `Payslip` tables).
3. Upload the file through the ATO STP portal and capture the reference number.
4. Update `PayRun`:
   - `stpStatus = 'FILED'`
   - `stpSubmissionId` to the ATO reference
   - `stpSubmittedAt = now()`
   - `stpAttempts += 1`
   - `stpLastAttemptAt = now()`
5. Append an audit log entry `ato.stp.manual_lodge` referencing the captured artefact and the
   reconciliation snapshot used for verification.
6. Notify stakeholders via the incident channel and reference the checklist in
   [ops.md](../ops.md) to resume automation.

**SLA References:**
- STP submissions must be lodged on or before payday. The new `stpLastAttemptAt` and
  `stpAttempts` fields provide verifiable telemetry for manual actions.

---

Always capture decisions and evidence through the immutable audit chain. If unsure, halt
and consult the incident lead before deviating from these steps.
