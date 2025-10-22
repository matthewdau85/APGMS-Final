# OWASP ASVS Mapping

## V2 Authentication
- **V2.1** Admin bearer tokens are schema-validated before access (`parsePrincipal`) → `services/api-gateway/src/routes/admin.data.ts`, tests `services/api-gateway/test/admin.data.delete.spec.ts`, `services/api-gateway/test/admin.data.export.spec.ts`.
- **V2.5** PII decryption endpoints enforce explicit admin guard callbacks → `services/api-gateway/src/lib/pii.ts`, tests `services/api-gateway/test/pii.spec.ts`.

## V3 Session Management
- N/A (all admin endpoints use per-request bearer tokens; no server-side session state).

## V4 Access Control
- **V4.1** Admin export/delete routes require configured admin token header → `services/api-gateway/src/app.ts`, tests `services/api-gateway/test/privacy.spec.ts`.
- **V4.2** Route-level org scoping ensures principals can only act within their org → `services/api-gateway/src/routes/admin.data.ts`, tests `services/api-gateway/test/admin.data.export.spec.ts`.

## V5 Validation, Sanitization, and Encoding
- **V5.1** Zod schemas validate admin payloads (`subjectDataExportRequestSchema`, `adminDataDeleteRequestSchema`) → `services/api-gateway/src/schemas/admin.data.ts`, tests `services/api-gateway/test/admin.data.export.spec.ts`, `services/api-gateway/test/admin.data.delete.spec.ts`.
- **V5.2** Financial line creation validates shape/idempotency and masks errors before logging → `services/api-gateway/src/app.ts`, tests `services/api-gateway/test/privacy.spec.ts`.

## V7 Error Handling & Logging
- **V7.1** Errors masked before logging to avoid leaking secrets (`maskError`) → `services/api-gateway/src/app.ts`, shared util `shared/src/masking.ts`.
- **V7.3** Security/audit events emitted for deletion, export, and PII decrypt operations → `services/api-gateway/src/routes/admin.data.ts`, `services/api-gateway/src/lib/pii.ts`, tests `services/api-gateway/test/admin.data.delete.spec.ts`, `services/api-gateway/test/admin.data.export.spec.ts`, `services/api-gateway/test/pii.spec.ts`.

## V9 Data Protection
- **V9.1** TFN tokenisation and AES-GCM encryption enforced via shared PII helpers → `services/api-gateway/src/lib/pii.ts`, tests `services/api-gateway/test/pii.spec.ts`.
- **V9.3** Audit trail ensures decryption events capture actor/action/timestamp metadata → `services/api-gateway/src/lib/pii.ts`, tests `services/api-gateway/test/pii.spec.ts`.

## V10 Communications
- N/A (service relies on upstream infrastructure for TLS termination; no direct transport configuration in repo).

## V11 Business Logic Security
- **V11.2** Idempotent bank-line creation prevents duplicate processing via composite unique keys → `services/api-gateway/src/app.ts`, tests `services/api-gateway/test/privacy.spec.ts`.

## V13 API and Web Service Security
- **V13.3** Health/readiness endpoints implement safe defaults with guarded DB connectivity → `services/api-gateway/src/app.ts`, tests `services/api-gateway/test/ready.spec.ts`.
