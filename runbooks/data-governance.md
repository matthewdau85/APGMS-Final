# Data Governance Runbook

This runbook documents the retention, anonymization, and access policies for operational
and compliance datasets produced by the APGMS platform. It covers the new discrepancy,
fraud, remediation, and payment-plan agreement records materialized from streaming
events, as well as the historical evidence data already present in Postgres.

## 1. Retention Policy

| Dataset / Table | Purpose | Retention | Rationale |
| --- | --- | --- | --- |
| `DiscrepancyEvent` | Source-of-truth for detected ledger irregularities and compliance cases | **7 years** from `detectedAt` | Matches ATO record-keeping obligations for tax-related discrepancies and mirrors core ledger retention windows |
| `FraudAlert` | Screening artefacts used to triage payments and suspicious activity | **5 years** from `triggeredAt` | Aligns with AUSTRAC guidance for AML/CTF alert evidence while limiting exposure of operational metadata |
| `RemediationAction` | Operational follow-up trail for resolving discrepancies/fraud | **5 years** from `createdAt` or **2 years** after `completedAt` (whichever is later) | Ensures remediation efficacy can be audited through the full lifecycle of a case |
| `PaymentPlanAgreement` | Structured payment-plan agreements negotiated with regulators | **7 years** from `startDate` or **2 years** after `endDate` (whichever is later) | Supports regulatory reviews of repayment schedules and dispute resolution |
| Event envelopes stored in `EventEnvelope` | Raw event audit trail backing downstream materialisations | **400 days** rolling window | Provides replay horizon for incident response while bounding storage cost |

Retention expiries are enforced via scheduled SQL jobs (see `infra/cron/data-retention.sql`) that
soft-delete rows by setting a `deletedAt` marker before archival purges. Backups retain deleted
rows for a further 30 days for legal hold reconciliation.

## 2. Anonymization & Minimisation

* Event payloads emitted by the API gateway intentionally avoid direct personal identifiers.
  * Ledger events expose bank-line metadata only in encrypted form or via key references
    (`payeeKey`, `idempotencyKey`) so that the ingestor stores opaque tokens.
  * Payments and remediation events include organisational identifiers and workflow context,
    but omit human names or email addresses; `owner` defaults to an internal subject ID.
* The compliance ingestor enriches records with an `orgNameSnapshot` that captures the
  organisation’s trading name at ingestion time. This snapshot is treated as organisational
  metadata rather than personal data and is refreshed whenever the ingestor reprocesses an
  event.
* Downstream ML feature tables operate on numeric features (amounts, thresholds, timelines)
  and hashed categorical columns (e.g. destination references) to prevent leakage of
  customer-specific details.
* When datasets are exported for analytics, the `metadata`, `terms`, and `context` JSON
  columns are filtered through the masking utilities in `@apgms/shared` to remove any
  incidental identifiers prior to sharing with third parties.

## 3. Access Controls & Monitoring

* **Primary access path:** service accounts used by the compliance analytics worker and
  regulated reporting jobs. Credentials are stored in the secrets manager and rotated every
  90 days.
* **Human access:** limited to the Compliance & Risk team (least-privilege roles in IAM).
  Access requires:
  * Just-in-time approval recorded in the audit log (`AuditLog` table).
  * MFA enforcement via the API gateway regulator portal.
  * Read-only replicas for analytical queries; direct writes flow exclusively through the
    compliance ingestor to preserve provenance.
* **Auditing:** every CRUD operation on the new tables is covered by Prisma middleware that
  writes to the `AuditLog` chain, and JetStream durable subscriptions retain a replayable
  history of processed events for forensic review.
* **Data egress:** exports must pass through the evidence-pack tooling (`scripts/export-evidence-pack.ts`)
  which redacts PII, watermarks payloads, and records the download in the security audit log.

Adhering to this runbook ensures that the platform meets Australian privacy and regulatory
expectations while enabling robust ML-driven compliance monitoring.
