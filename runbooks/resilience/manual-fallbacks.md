# Manual fallback playbooks

This runbook documents the actions required when automated BAS lodgment or remittance flows are unavailable. Operators should follow the relevant section to maintain compliance while the incident response team restores normal service.

## 1. Manual BAS lodgment

### Triggers
- ATO lodgment API returning `AWAITING_MANUAL_REVIEW` or `REJECTED` statuses after automated retries.
- Lodgment queue marked with `MANUAL` status by the `@apgms/ato-filer` worker.
- Regulator deadline approaching (T-24 hours) with outstanding submissions.

### Preconditions
- Confirm latest reconciliation snapshot exists for the BAS period.
- Collect evidence artifacts (designated account balance, payroll summaries, POS settlements).
- Notify compliance lead and customer success owner for the impacted organisation(s).

### Procedure
1. Retrieve the queued lodgment payload from the operations dashboard (`/ops/lodgments/:id`).
2. Validate totals against the reconciliation snapshot variance.
3. Complete the BAS form in the ATO business portal:
   - Use the values from the payload and reconciliation report.
   - Attach evidence artifacts exported from the ledger.
4. Submit the BAS manually and capture the receipt number.
5. Update the lodgment record via the admin console:
   - Set status to `SUBMITTED`.
   - Record the ATO receipt number and operator ID in the immutable audit log.
6. Trigger the `designated-account` release workflow for PAYGW/GST transfers once confirmation is received.

### Post-lodgment
- Upload supporting evidence to the WORM store and link the artifact to the `ReconciliationSnapshot` entry.
- Create an incident ticket referencing the manual lodgment for retrospective review.
- Monitor for ATO acceptance notifications and update the record accordingly.

### SLA expectations
- Manual submission must start within 1 business hour of trigger detection.
- Completion deadline: before statutory due date or within 4 business hours, whichever is sooner.
- Incident retrospective scheduled within 3 business days.

## 2. Deferred remittance workflow

### Purpose
Allows finance operators to defer disbursement from designated accounts when banking connectors report outages, while keeping deposit-only controls intact.

### Triggers
- Banking connector returning 5xx errors for two consecutive attempts.
- Reconciliation snapshot variance exceeding 1% due to pending remittances.
- Manual override requested by treasury lead.

### Procedure
1. Flag the affected designated account by creating a `DesignatedAccountState` entry with status `SUSPENDED`.
2. Record an `AuditLog` entry referencing the suspension rationale and expected review date.
3. Pause outbound payment jobs in the scheduler (`worker payments:pause --account <id>`).
4. Notify customers via the status page template "Deferred Remittance".
5. Once banking availability is restored:
   - Create a `DesignatedAccountState` entry returning the account to `ACTIVE`.
   - Resume payment jobs and execute queued remittances.
   - Record each deposit-only transfer in the `DesignatedAccountDepositLog` with supporting evidence hashes.

### Monitoring
- Review the reconciliation dashboard every 30 minutes for variance drift.
- Escalate to finance leadership if suspension exceeds 6 business hours.

### SLA expectations
- Initial suspension decision documented within 30 minutes of trigger.
- Deferred remittances cleared within 1 business day of banking recovery.

## Communication
- Incident bridge: `#inc-banking` (Slack).
- Status page updates: every 60 minutes while manual processes remain active.
- Customer success notified for impacted organisations with personalised updates every 4 hours.

## Audit requirements
- All manual actions must reference immutable `AuditLog` hashes.
- Deposit-only constraint validated via the check constraint introduced in migration `20250210_add_designated_account_controls.sql`.
- Retain supporting documentation for seven years in compliance storage.

