# OWASP ASVS L2 Coverage Map

The table below documents the ASVS v4.0.3 level 2 controls that are implemented in this repository today. Each entry links to the
relevant service code and automated tests that demonstrate the control in action. Controls that are out-of-scope for our
current architecture (for example mobile-specific requirements) are tracked in the "Notes" column with their rationale.

| ASVS control | Description | Implementation | Verification | Notes |
| --- | --- | --- | --- | --- |
| V2.1.1 | Enforce that administrative endpoints require strong authentication. | `requireAdmin` guards the subject export and deletion routes, comparing the inbound header against the rotated `ADMIN_TOKEN`. 【services/api-gateway/src/app.ts#L101-L152】 | `privacy.spec.ts` exercises the admin export/delete paths and verifies `403` when the token is missing. 【services/api-gateway/test/privacy.spec.ts#L34-L59】 | Token rotation steps are documented in the On-call Rotation runbook.
| V5.1.3 | Validate and reject malformed input on the server. | The `CreateLine` schema applies strict Zod validation (type, format, bounds) before touching persistence. 【services/api-gateway/src/app.ts#L40-L88】 | The `admin.data.delete` suite rejects malformed confirmation tokens and missing subject records. 【services/api-gateway/test/admin.data.delete.spec.ts#L60-L104】 | Client-side validation is handled separately in the web UI backlog.
| V7.3.3 | Ensure logs do not leak sensitive data. | `maskError` and `maskObject` redact secrets before logging and are used when persisting bank lines. 【services/api-gateway/src/app.ts#L89-L135】【shared/src/masking.ts#L1-L94】 | The PII unit tests assert decrypted payloads never surface in audit events. 【services/api-gateway/test/pii.spec.ts#L64-L115】 | Applies to structured logs emitted by Fastify and workers.
| V9.1.1 | Protect personal data using industry-standard cryptography. | `encryptPII` uses AES-256-GCM with per-record IVs, authenticated tags, and key rotation hooks. 【services/api-gateway/src/lib/pii.ts#L38-L111】 | `pii.spec.ts` covers tokenisation, encryption, decryption, and audit logging. 【services/api-gateway/test/pii.spec.ts#L19-L119】 | Keys and salts are managed by the platform HSM; see Key Rotation SOP.
| V11.1.1 | Expose a minimal, well-defined API surface with explicit schemas. | Admin data routes validate payloads against shared schemas before executing business logic, limiting mass-assignment. 【services/api-gateway/src/routes/admin.data.ts】【services/api-gateway/src/schemas/admin.data.ts】 | `admin.data.delete.spec.ts` validates that only expected fields are processed and that authorisation happens before DB access. 【services/api-gateway/test/admin.data.delete.spec.ts#L66-L96】 | Remaining routes follow the same schema-first approach (tracked in API backlog).
| V13.3.1 | Continuously monitor component health. | `/ready` performs a database round-trip before declaring the service ready, preventing traffic when dependencies are unavailable. 【services/api-gateway/src/app.ts#L71-L87】 | `ready.spec.ts` confirms a `200` response only when the database is reachable. 【services/api-gateway/test/ready.spec.ts#L1-L14】 | Cluster-level probes reuse this endpoint; see Status Site procedure.

## Gaps and remediation tracking

* V2.2 Multi-factor enforcement for administrative sessions is pending integration with the identity provider. See the incident
  response playbook for compensating detective controls.
* V6.2 Input validation for file uploads is not applicable because the platform does not accept binary uploads.
* V10.2 Server-side templating protections are not applicable to our single-page web client; DOM XSS mitigations are tracked in the
  web application security backlog.

## Related compliance artefacts

* The DPIA summarises data flows and residual privacy risks for the TFN and bank-statement features. 【docs/privacy/dpia.md#L1-L87】
* The Notifiable Data Breach runbook documents regulator-facing communication obligations. 【runbooks/ndb.md#L1-L81】
