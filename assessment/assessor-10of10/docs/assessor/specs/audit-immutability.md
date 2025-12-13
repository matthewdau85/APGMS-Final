# Audit immutability spec

Audit events MUST be append-only:
- No updates/deletes are permitted in the audit store outside time-boxed retention processing.
- Retention deletes must be recorded as "retention_action" events, not silent deletes.

Each audit event MUST include:
- timestamp (UTC)
- orgId (tenancy)
- principalId (who)
- action (what)
- requestId/correlationId (traceability)
- result (success/failure)
- hash chain fields if using tamper-evident logs

Evidence targets:
- Test verifies audit writes are only inserts
- Log/events are traceable end-to-end in golden path contract
