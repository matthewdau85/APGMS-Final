# Event Bus Topic Catalogue

The APGMS platform exposes a typed event bus abstraction (backed by NATS in
non-production) to distribute transactional events across services. The shared
[`@apgms/shared/messaging/transactional-events`](../../shared/src/messaging/transactional-events.ts)
module holds the canonical TypeScript interfaces and protobuf contracts. Each
payload now embeds immutable identifiers (`eventId`) and ISO-8601 timestamps
(`occurredAt`) so downstream systems can guarantee ordering, deduplicate safely
and maintain lineage.

## Transactional Topics

| Topic | Description | Producer(s) | Schema | Retention target |
| --- | --- | --- | --- | --- |
| `payments.transaction.initiated` | Payment instruction accepted for processing. | [payments service](../../services/payments/events/README.md) | `PaymentInitiatedEvent` | 7 years (regulatory) |
| `payments.transaction.settled` | Payment cleared by the rails. | [payments service](../../services/payments/events/README.md) | `PaymentSettledEvent` | 7 years |
| `payments.transaction.failed` | Payment rejected downstream. | [payments service](../../services/payments/events/README.md) | `PaymentFailedEvent` | 7 years |
| `recon.designated.reconciliation.generated` | Nightly designated account summary produced for regulators. | [worker reconciliation job](../../services/recon/events/README.md) | `ReconciliationGeneratedEvent` | 7 years |
| `audit.log.recorded` | Immutable audit log entry persisted. | [audit service](../../services/audit/events/README.md) | `AuditLogRecordedEvent` | 7 years |

Use the [`TransactionalEventCatalog`](../../shared/src/messaging/transactional-events.ts)
export to programmatically inspect the set of supported topics and owners when
building tooling.

## Publishing guidelines

1. Construct payloads using the shared interfaces and populate the
   `eventId`, `occurredAt`, `schemaVersion` (currently `2024-11-01`) and
   `source` fields before publishing.
2. Validate payloads locally with `assertBaseEventPayload` to fail fast on
   missing identifiers.
3. Emit events via `@apgms/shared/messaging/event-bus` so transports can be
   swapped (in-memory, NATS, Kafka).

## Storage and replay

Long-term retention for regulatory evidence is implemented in
[`worker/src/storage/data-lake.ts`](../../worker/src/storage/data-lake.ts). The
worker jobs persist every reconciliation event to object storage and enforce
retention windows while running integrity checks (hash verification, non-negative
balances). Additional sinks (e.g. warehouses) should subscribe to the same
topics to maintain a consistent replay log.
