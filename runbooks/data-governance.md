# Data Governance Policies

This runbook defines the operational policies for handling compliance telemetry and derived datasets across APGMS platforms. The guidance applies to all services that produce or consume the discrepancy, fraud-alert, remediation, and payment-plan data flows.

## 1. Data Retention

- **Raw events (NATS + `EventEnvelope` table):** retain for 400 days to satisfy regulator audit trails and to support long-running investigations. Purge records older than 400 days via weekly maintenance (`DELETE FROM "EventEnvelope" WHERE "ts" < now() - interval '400 days'`).
- **Operational entities (`Discrepancy`, `FraudAlert`, `RemediationAction`, `PaymentPlanAgreement`):** retain until the underlying obligation is resolved plus 7 years. Closure is defined by `status` transitions (`closed`, `CLOSED`, `completed`, or `settled`).
- **Derived KPIs (`compliance.baseline.kpi`) and training datasets (`compliance.training.dataset` envelopes):** keep the most recent 24 versions per organisation; delete older snapshots on each refresh to minimise footprint.
- **Backups:** ensure encrypted database backups capture all four entity tables and the `EventEnvelope` feed. Retain daily backups for 90 days and monthly backups for 7 years in accordance with statutory requirements.

## 2. Anonymisation & Minimisation

- **PII scrubbing:** never store customer names, account numbers, or TFNs in the new tables. When ingestion encounters payload fields that may contain PII (for example `details` or `metadata`), hash or redact before persisting. The ingestion worker enforces this by only storing structured metrics and IDs.
- **Dataset exports:** when exporting training datasets, strip organisation identifiers and replace with pseudonymous dataset keys (e.g. `orgHash`). Use salted SHA-256 derived from the `orgId` and the current quarter so datasets cannot be re-identified if leaked.
- **Access logs:** every read of discrepancy or fraud-alert data must be logged via the existing audit subsystem. Instrument UI/reporting surfaces to emit `read:compliance-dataset` audit events including purpose codes.
- **Minimised payloads:** downstream services should consume the KPI snapshot rather than the raw event stream wherever possible. This avoids unnecessary replication of sensitive data.

## 3. Access Controls

- **Service-to-service:** grant the ingestion worker and analytics pipelines dedicated database roles with read/write rights limited to the new tables and `EventEnvelope`. Revoke `UPDATE` on unrelated ledger tables for those roles.
- **Human access:** restrict direct SQL access to the discrepancy/fraud tables to the compliance analytics squad. Require break-glass approval recorded in PagerDuty for any exceptions.
- **API exposure:** the new Fastify endpoints require roles `analyst` or `admin`. Keep subject-prefix secrets (`NATS_SUBJECT_PREFIX`, `NATS_STREAM`) in sealed secrets management and rotate tokens quarterly.
- **Monitoring:** enable alerts when unusual volumes of exports or deletes occur. A baseline is >3 dataset exports or >100 deletions within an hour.

## 4. Incident Response

- **Breach handling:** if unauthorised access is detected, immediately pause NATS publishing via the feature flag (`NATS_PUBLISHING_DISABLED`, deployable environment variable) and rotate NATS credentials. Notify the DPO within 24 hours.
- **Data correction:** when false positives are identified, create a remediation action entry with `metadata.correctiveAction=true` so downstream models exclude the sample on the next refresh.
- **Audit evidence:** ensure that remediation steps and payment plans reference the source discrepancy/fraud-alert IDs to maintain a continuous audit trail.

## 5. Change Management

- Any schema change to the four compliance tables must undergo privacy review.
- Update this runbook whenever retention periods or anonymisation techniques change; include ticket references in the change history.

_Last reviewed: 2025-03-12_
