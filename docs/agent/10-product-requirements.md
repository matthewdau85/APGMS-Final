# Product Requirements (Derived from Patent)

Each requirement has an ID. All engineering work must reference one or more IDs.

## R-001 Designated one-way accounts (deposit-only)
APGMS must support designated one-way accounts for PAYGW and GST that:
- Allow deposits only (no withdrawals / no diversion).
- Are used to secure funds intended for tax remittance.

## R-002 Payroll integration for PAYGW (real-time calculation)
APGMS must integrate with payroll systems to:
- Ingest payroll data.
- Calculate PAYGW automatically and accurately.
- Secure calculated PAYGW amounts into the PAYGW one-way account.

## R-003 POS integration for GST (real-time calculation)
APGMS must integrate with POS systems to:
- Ingest transaction data.
- Calculate GST per transaction (or via configurable settlement cadence).
- Secure calculated GST amounts into the GST one-way account.

## R-004 Banking integration (secure APIs)
APGMS must integrate with banking systems via secure APIs to:
- Transfer PAYGW/GST from the revenue account into one-way accounts.

## R-005 BAS lodgment gate (verify funds + remit)
At BAS lodgment, APGMS must:
- Verify sufficient funds exist in PAYGW and GST one-way accounts.
- Initiate remittance transfers to government accounts.

## R-006 Error handling + reconciliation
APGMS must:
- Reconcile transfers (success/failure verification).
- Alert on insufficient funds, network failures, or other errors.
- Support corrective actions (retry, schedule adjustment, or payment-plan pathway).

## R-007 Compliance dashboard + reminders
APGMS should provide a dashboard that:
- Shows real-time status of PAYGW/GST obligations.
- Shows upcoming BAS deadlines and reminders.
- Supports generating compliance reports and viewing history.

## R-008 Audit trail (discrepancies + actions)
APGMS must:
- Log discrepancies and actions taken to resolve them.
- Maintain audit-grade documentation suitable for compliance review.

## R-009 Payment plan + remission support artefacts
APGMS should support producing documentation that can support:
- Payment plan proposals.
- Remission requests (penalties/interest) where proactive compliance evidence exists.

## R-010 Security controls
APGMS must apply security controls including:
- MFA for privileged access.
- Encryption in transit for data flows.
- Monitoring for anomalous/fraudulent transfer patterns.
