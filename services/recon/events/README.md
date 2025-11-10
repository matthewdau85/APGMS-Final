# Reconciliation Event Topics

The reconciliation worker emits a single high-value event that captures the
regulator-facing designated account summary. The payload references the shared
`ReconciliationGeneratedEvent` schema to guarantee immutable identifiers and
timestamps across the bus.

| Topic | Description | Payload schema | Producers | Consumers |
| --- | --- | --- | --- | --- |
| `recon.designated.reconciliation.generated` | Nightly designated account reconciliation artefact is produced. | `ReconciliationGeneratedEvent` | Worker (`designated-reconciliation` job) | Evidence archive, reporting warehouse |

Refer to [`catalog.ts`](./catalog.ts) for the canonical payload example that
passes validation.
