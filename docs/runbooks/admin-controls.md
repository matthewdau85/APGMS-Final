# Admin Controls Runbook

## Purpose
Record every administrator mutation (delete/export) with a correlated, redacted audit trail so you can prove TFN/PII controls to regulators.

## Logging & correlation
- The gateway uses `@apgms/shared/security-log` to build `SecurityLogEntry` objects when `secLog` is called in `services/api-gateway/src/routes/admin.data.js`.
- Each log entry includes `event`, `orgId`, `principal`, the `subjectUserId`/`subjectEmail`, and the new `occurredAt` timestamp.  It also records whichever correlation ID accompanies the inbound HTTP request: `x-correlation-id` first, falling back to Fastify’s `request.id`.
- The default `secLog` implementation writes the sanitized entry via `logSecurityEvent(app.log, entry)`, so you can filter `security_event` log lines by `security.event` and correlation ID before showing them to auditors.

## Auditing & redaction
- In addition to the log entry, each admin action creates an `AuditLog` row via `logAuditEvent` that stores hashed metadata (e.g., subject IDs/emails). Use the linked hash chain (`recordAuditLog`) to prove tamper resistance.
- To investigate requests, arm your SIEM with a dashboard that joins `security_event` entries with their `correlationId` and the matching audit log `hash`. The runbook’s `Designated Accounts Governance` file links to the nightly reconciliation artefact; this file now links back so regulators can trace from audit log → security log → evidence artefact.

## Operations
1. When troubleshooting an admin delete/export, capture the `x-correlation-id` header (or Fastify `req.id`) and query the centralized logs for `1 security_event` entries with that ID.
2. Confirm `security.event` log entries show sanitized values (no raw TFNs) by checking they pass through `shared/src/redaction.ts` and `shared/src/logging.ts`.
3. Verify a matching row in `AuditLog` exists with the same `orgId` and `action` (e.g., `data_delete` or `data_export`), then note the `hash` value so auditors can confirm chain integrity.
4. If a log entry lacks `correlationId`, ensure the client now sends `x-correlation-id` or fix the Fastify middleware to inject new IDs before hitting the admin routes; the default helper already falls back to `request.id`.

## Review
- Include this runbook in quarterly compliance reviews alongside the `designated accounts governance` runbook so executives can see that both admin and automated processes are fully traceable.
