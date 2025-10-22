# OWASP ASVS Control Mapping

| Control | Implementation | Evidence (file:line/workflow) |
| --- | --- | --- |
| V1.4.1 – Enforce a strict Content Security Policy | The SPA bootstrap page declares a restrictive CSP that blocks inline code, forbids external frames, and limits asset sources to the same origin. | webapp/index.html:L6-L9 |
| V2.1.1 – Enforce authenticated access to administrative interfaces | Admin export and deletion endpoints require a configured admin token before executing. | services/api-gateway/src/app.ts:L109-L165; services/api-gateway/test/privacy.spec.ts:L32-L44 |
| V5.2.4 – Use parameterized queries or safe ORM access for data persistence | Bank line creation persists requests via Prisma, avoiding string concatenation and automatically parameterizing values. | services/api-gateway/src/app.ts:L84-L105 |
| V7.2.3 – Prevent sensitive data leakage in logs | Error handlers mask secrets before logging by delegating to the shared masking utility. | services/api-gateway/src/app.ts:L103-L105; shared/src/masking.ts:L1-L107 |
| V9.1.1 – Support data export and deletion with auditability | Admin deletion runs inside a transaction, scrubs tenant data, and records a tombstone for accountability. | services/api-gateway/src/app.ts:L126-L165; services/api-gateway/test/privacy.spec.ts:L54-L91 |
| V11.2.2 – Protect secrets and identifiers using approved cryptography | TFN tokenization and decryption flows rely on vetted crypto helpers and emit audit events for administrator access. | services/api-gateway/test/pii.spec.ts:L68-L126 |
