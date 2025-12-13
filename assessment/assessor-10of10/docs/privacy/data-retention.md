# Data retention and deletion

Retention objectives:
- Keep only what is required for compliance and product operation.
- Support user/regulator requests with traceable evidence.

Schedule (example - update for APGMS):
- Audit logs: 7 years (or per regulator expectation), immutable
- Ledger records: 7 years
- Raw ingestion payloads: 90 days unless required for dispute/audit
- Access logs: 180 days
- Backup retention: 30-90 days with monthly snapshots

Deletion:
- Implement retention jobs and record retention actions as audit events.
- Deletion must respect tenancy boundaries and preserve required audit/ledger records.

Evidence:
- Job implementation exists in worker/src/jobs/data-retention.ts (or equivalent)
- Restore drill validates deletions do not break integrity
