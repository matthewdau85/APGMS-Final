# Data Governance & Controls

This guide captures the policies that govern how transactional and personally
identifiable information (PII) flows through APGMS. It complements the
[platform architecture](../ADR-001-platform-architecture.md) by highlighting the
data contracts, storage tiers and access controls that keep the platform
compliant.

## Data classification

| Classification | Examples | Controls |
| --- | --- | --- |
| **Public** | Documentation, release notes | Published openly, no authentication required |
| **Confidential** | Product analytics, internal metrics | Role-based access via identity provider, logged access |
| **Regulated** | Payroll withholding (PAYGW), GST balances, audit evidence | Encrypted at rest, WORM storage, 7 year retention |
| **Sensitive PII** | User credentials, MFA secrets, TFNs | Tokenised or hashed in services, least-privilege access, irreversible masking in logs |

## Event bus governance

* All transactional topics are catalogued in
  [`infra/event-bus/README`](../../../infra/event-bus/README.md) with owning teams
  and downstream consumers.
* Payload schemas live in
  [`@apgms/shared/messaging/transactional-events`](../../../shared/src/messaging/transactional-events.ts)
  and every event embeds immutable identifiers (`eventId`) and source
  timestamps (`occurredAt`).
* `assertBaseEventPayload` should be executed prior to publishing to guarantee
  identifiers are present. Violations are treated as deployment blockers.

## PII handling

* Sensitive fields (TFNs, MFA secrets) must be tokenised using
  `@apgms/shared/security` utilities before persistence or emission.
* The API gateway and services redact PII in logs via
  `@apgms/shared/masking` helpers. Any payload emitted on the bus must exclude
  free-form PII; instead reference opaque identifiers or hashed values.
* Data exports generated for regulators are encrypted using envelope encryption
  (`@apgms/shared/crypto/envelope`). Keys are stored in the secret manager and
  rotated quarterly.

## Access control & auditing

* Long-term storage for transactional events is centralised in the object store
  managed by [`worker/src/storage/data-lake.ts`](../../../worker/src/storage/data-lake.ts).
  Access is granted to the compliance, finance and platform SRE roles only.
* Object store buckets enforce immutable WORM policies with automatic retention
  expiry. Access attempts and deletions are streamed into the audit service via
  the `audit.log.recorded` topic.
* Database access is brokered through IAM roles; direct administrator logins are
  prohibited outside emergency break-glass procedures.

## Quality checks & retention

* Worker ingestion jobs validate reconciliation payloads before persisting them
  (hash verification, non-negative balances). Failed checks raise high severity
  alerts in the monitoring stack.
* Default retention for regulated topics is **7 years**, configurable per topic
  via environment variables (`RECON_EVENT_RETENTION_DAYS`,
  `LONG_TERM_STORAGE_RETENTION_DAYS`). Shorter retention requires approval from
  Legal & Compliance.
* Quarterly data quality reviews sample events from each topic to confirm
  schema adherence, identifier immutability and reconciliation between bus
  events and warehouse snapshots.
