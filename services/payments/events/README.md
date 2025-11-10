# Payments Event Topics

The payments service emits transactional events via the shared event bus to
broadcast the lifecycle of customer initiated payments. Each payload embeds the
immutable `eventId` and `occurredAt` fields defined in
[`@apgms/shared/messaging/transactional-events`](../../../shared/src/messaging/transactional-events.ts)
to guarantee traceability.

| Topic | When it fires | Payload schema | Downstream consumers |
| --- | --- | --- | --- |
| `payments.transaction.initiated` | Payment instruction passes validation and is persisted. | `PaymentInitiatedEvent` | Reconciliation jobs, alerts |
| `payments.transaction.settled` | Clearing and settlement have completed successfully. | `PaymentSettledEvent` | Financial reporting, compliance dashboards |
| `payments.transaction.failed` | Downstream rails reject the instruction. | `PaymentFailedEvent` | Support workflows, retry automation |

See [`catalog.ts`](./catalog.ts) for concrete payload examples that satisfy the
shared contract.
