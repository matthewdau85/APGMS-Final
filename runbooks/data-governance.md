# Data Governance Runbook

## Scope
This runbook covers the compliance datasets populated by the API gateway and the compliance ingestor worker:

- `DiscrepancyEvent` – raw discrepancy and override signals enriched with organisational context.
- `FraudAlert` – escalations created for high-risk discrepancy events.
- `RemediationAction` – curated remediation tasks and feature snapshots prepared for model training.

The sources of truth are defined in `shared/prisma/schema.prisma` and the ingestion worker at `worker/compliance-ingestor`.

## Retention
| Dataset | Primary Purpose | Retention Window | Rationale |
|---------|-----------------|------------------|-----------|
| `DiscrepancyEvent` | Raw discrepancy / override telemetry and feature snapshots | 18 months rolling | Provides sufficient history for seasonal analysis without retaining obsolete manual overrides indefinitely. |
| `FraudAlert` | High-risk incidents and investigator outcomes | 24 months rolling | Maintains evidence for regulatory reviews while respecting least-retention principles. |
| `RemediationAction` | Labelled remediation decisions for training pipelines | 36 months rolling | Longer horizon required for supervised learning back-tests; data is already redacted. |

Retention enforcement is performed by the nightly data hygiene job. Define the `DATA_RETENTION_DAYS_*` environment variables on that job to shorten the windows if local policy requires it. The worker never deletes records directly; it only appends and updates derived columns.

## Redaction Controls
- Actor identifiers remain in the transactional tables to support reconciliation but **must** be hashed before export. Use the deterministic hashing helper in `shared/src/security/password.ts` when preparing analytics extracts.
- Free-form `metadata` payloads are sanitised by the worker to remove `undefined` values and coerce timestamps to ISO-8601 strings. Sensitive fields (PII, bank details) should be encrypted at the producer; if a producer cannot guarantee this, add a scrubber in `publishComplianceEvent` before shipping the payload.
- When generating external datasets, drop the following columns: `actorId`, `actorRole`, `orgNameSnapshot`. Replace them with organisation-tier buckets (e.g. headcount bands) sourced from the master data warehouse.

## Sampling Guidance
Training jobs should use stratified sampling across severity tiers and event kinds:

1. Split `DiscrepancyEvent` records into four strata (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
2. Within each severity, down-sample overrides so that they represent at most 35% of the batch to avoid model bias towards manual interventions.
3. Ensure every active organisation contributes at least five examples per quarter. If an org lacks sufficient events, synthesise “no-issue” negatives from routine reconciliations to keep the class balance stable.
4. Always join to `RemediationAction` when constructing labelled datasets so that remediation outcomes are aligned with the latest `features` snapshot.

## Right-to-be-Forgotten Requests
When an end-user invokes GDPR/CCPA erasure:

1. Run the existing subject erasure flow in the API gateway (`/admin/data/delete`).
2. Trigger the compliance ingestor hygiene script with the subject identifier. The script should:
   - locate any `DiscrepancyEvent` rows whose `metadata.event.subjectUserId` matches the user,
   - overwrite `actorId`, `metadata.event.subjectUserId`, and any nested email/phone values with irreversible hashes,
   - append a `redactedAt` timestamp to the `metadata` block.
3. Rebuild the downstream feature store to purge cached embeddings.

## Audit Readiness Checklist
- ✅ Retention jobs have succeeded in the last 7 days (`metrics.data.retention.success=1`).
- ✅ Redaction script last run timestamp is less than 30 days old.
- ✅ Stratified sampling reports match the target ratios (see the analytics dashboard `compliance_sampling`).
- ✅ Compliance ingestor worker heartbeat metric (`worker.compliance_ingestor.heartbeat`) is green.

If any check fails, escalate to the data steward before releasing updated training corpora.
