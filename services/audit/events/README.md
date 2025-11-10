# Audit Event Topics

The audit service is the source of truth for regulated audit trail events. Each
message carries the immutable identifiers defined in the shared transactional
schema to simplify lineage analysis and retention tracking.

| Topic | Description | Payload schema | Notes |
| --- | --- | --- | --- |
| `audit.log.recorded` | Audit entry persisted for a regulated action. | `AuditLogRecordedEvent` | Serves downstream compliance dashboards and regulator exports |

Concrete payload examples can be found in [`catalog.ts`](./catalog.ts).
