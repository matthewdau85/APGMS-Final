# Risk Event Data Governance Runbook

This runbook describes how discrepancy, fraud, remediation, and training-snapshot
records are governed so that the machine-learning (ML) datasets sourced from
these tables remain auditable and privacy-compliant.

## Data domains

| Dataset | Purpose | Primary tables |
| --- | --- | --- |
| Discrepancy telemetry | Captures validation failures, overrides, and balance drift from gateway services. | `DiscrepancyEvent`, `FraudAlert` |
| Operational response | Tracks remediation playbooks and payment-plan follow through. | `RemediationAction`, `PaymentPlanCommitment` |
| ML training snapshots | Immutable extracts that feed feature stores and experimentation. | `TrainingSnapshot` |

## Retention windows

| Table | Retention window | Notes |
| --- | --- | --- |
| `DiscrepancyEvent` | 24 months | Supports regulator lookbacks and fraud-model backtesting. Events older than the window should be tombstoned quarterly after export to cold storage. |
| `FraudAlert` | 24 months | Mirrors discrepancy retention so investigations can be reconstructed. Closed alerts inherit the parent event's purge timeline. |
| `RemediationAction` | 18 months | Long enough to measure remediation effectiveness while limiting exposure to sensitive operator notes. |
| `PaymentPlanCommitment` | 7 years | Aligns with statutory tax-payment obligations; anonymise debtor PII before archival. |
| `TrainingSnapshot` | 12 months | Rolling window that matches the ML training horizon. Snapshots older than 12 months are re-generated from cold-storage events when necessary. |

Retention enforcement runs as part of the monthly `risk-data-retention` job (to be
scheduled in Airflow). The job applies the following order of operations:

1. Export qualifying rows to the write-once archive bucket (`gs://apgms-risk-archive`).
2. Redact primary identifiers inline (see “Redaction routines”).
3. Soft-delete the row by setting `acknowledgedAt` or adding a `metadata.redacted = true` flag.
4. Permanently delete rows once regulator sign-off is captured in `EvidenceArtifact`.

## Redaction routines

To minimise privacy exposure while maintaining auditability, apply the following
redaction steps before any dataset leaves the primary Postgres instance:

### Discrepancy events and fraud alerts

- Replace actor identifiers with salted hashes using the `@apgms/shared` hashing helpers.
- Remove raw request payloads; retain only structured descriptors (`reason`, `issues`, `driftAmount`).
- Truncate free-form notes to 250 characters and mask account numbers via the masking utilities in `@apgms/shared`.

### Remediation actions

- Strip operator comments except for categorical labels (`manual_review`, `suspension`, etc.).
- Collapse timeline metadata to `createdAt` and `executedAt`—drop intermediate checkpoints.
- When storing external ticket references, replace them with surrogate IDs recorded in `EvidenceArtifact`.

### Payment-plan commitments

- Retain only aggregate commitment values (`amount`, `dueDate`, status flags).
- Null out customer-facing identifiers before export.
- For ML features, provide bucketing (`<30d`, `30-60d`, `>60d`) instead of exact due dates.

### Training snapshots

- Snapshots are immutable. When redacting, generate a new snapshot with `snapshotType = 'risk_event.redacted'` that points to the original `discrepancyId` and store only derived features.
- Retain the original snapshot row until the redacted version is verified, then mark `payload.redacted = true`.

## Audit controls

- Every retention or redaction batch must insert an `EvidenceArtifact` row with the SHA-256 checksum of the exported dataset and the reference to the change ticket.
- Quarterly sampling of 5% of retained events is required to confirm that redaction controls still remove direct identifiers.
- The ingestion worker tags each event with `schemaVersion` so downstream consumers can validate contracts before use.

## Incident response

If a privacy incident is suspected:

1. Freeze the relevant `FraudAlert` and `RemediationAction` records by setting `status = 'ESCALATED'`.
2. Trigger the `risk_ingestion_hold` toggle in configuration so the worker pauses after the next ack (implemented by setting the worker deployment to draining mode).
3. Export affected `TrainingSnapshot` rows to a quarantined bucket and wipe feature caches derived from them.
4. File an incident ticket referencing the `DiscrepancyEvent` IDs and attach the associated `EvidenceArtifact` hashes for audit.

Following remediation, document the corrective actions in a new `RemediationAction` entry linked to the originating discrepancy to maintain the chain of custody.
