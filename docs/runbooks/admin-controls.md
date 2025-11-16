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

## Regulatory Readiness Checklist
- [ ] **DSP OSF questionnaire filed** – store the export metadata in `artifacts/compliance/dsp-osf-registration.json` (includes product ID, reviewer, checksum) and link that file from `artifacts/compliance/regulatory-status.json`. Update this runbook with the submission date and reviewer.
- [ ] **AUSTRAC enrolment** – capture the current status (`pending`, `submitted`, or `approved`) plus the next action owner inside `artifacts/compliance/regulatory-status.json.austrac`. Reference that entry here so auditors can trace the evidence trail.
- [ ] **ASIC/AFSL posture** – log whether the sandbox relies on the partner’s licence or requires a standalone AFSL in the same JSON (`asic` section). Note who in Legal owns the next action and when the licence review is due.
- [ ] **Partner contract status** – keep the `partnerContract` block in `artifacts/compliance/regulatory-status.json` updated with the sandbox agreement reference and expiry. Confirm that the `partner-info.json` timestamp matches the credentials loaded into production.
- [ ] **Pilot evidence** – verify that at least two pilot JSON files exist in `artifacts/compliance/` and that `/compliance/pilot-status` returns those pilots plus the DSP product ID before a regulator review.

## Partner & DSP Metadata
- The `artifacts/compliance/partner-info.json` file is rewritten whenever `/compliance/transfer` runs with `DESIGNATED_BANKING_URL`/`DESIGNATED_BANKING_TOKEN` configured. Before each release, attach that JSON to the regulator evidence pack so reviewers can see the exact URL, DSP product ID, and certificate fingerprint in use.
- Keep the `artifacts/compliance/regulatory-status.json` document in sync with real submissions (DSP OSF reference, AUSTRAC state, ASIC/AFSL notes). When anything changes, update this runbook with the new product ID and link to the JSON so the checklist above can be audited end-to-end.
