# Data Protection Impact Assessment

## Systems in scope
- **Client web application** – Vite/React SPA delivered from [`webapp/`](../../webapp/) that captures portfolio telemetry and administrative commands.
- **API Gateway** – Fastify service at [`services/api-gateway/`](../../services/api-gateway/src/app.ts) orchestrating user listings, bank line ingestion, and privileged export/deletion requests.
- **Shared security utilities** – Common masking and PII helpers in [`shared/src/masking.ts`](../../shared/src/masking.ts) and [`services/api-gateway/src/lib/pii.ts`](../../services/api-gateway/src/lib/pii.ts) that enforce cryptographic and logging controls.

## Data categories processed
- **User directory metadata** (email, organisation relationship, creation timestamp) returned by `/users` and exported via admin endpoints.【F:services/api-gateway/src/app.ts†L67-L125】
- **Bank line financial records** (org identifier, transaction amount, payee narratives) created through the `/bank-lines` route and surfaced in the admin export payload.【F:services/api-gateway/src/app.ts†L75-L165】
- **Tokenised TFNs and encrypted subject identifiers** safeguarded by the PII module and never persisted in plaintext.【F:services/api-gateway/src/lib/pii.ts†L37-L120】【F:services/api-gateway/test/pii.spec.ts†L68-L126】

## Data flows and transfers
- The SPA issues same-origin requests to the API Gateway; responses are rendered client-side with no third-party embeds thanks to the CSP lockdown.【F:webapp/index.html†L6-L14】
- Administrative operators access export and deletion routes over authenticated channels using one-time admin tokens, after which JSON payloads are downloaded locally for regulatory requests.【F:services/api-gateway/src/app.ts†L109-L165】
- PII decrypt operations require explicit admin approval and emit audit events to downstream log processors, providing traceability for TFN handling.【F:services/api-gateway/src/lib/pii.ts†L93-L120】【F:services/api-gateway/test/pii.spec.ts†L81-L126】

## Identified risks and mitigations
- **Risk:** Browser compromise via malicious third-party scripts.
  - **Mitigation:** Strict CSP restricting scripts, styles, and frames to `'self'`, and usage of semantic components to avoid inline styling that would weaken CSP.【F:webapp/index.html†L6-L14】【F:webapp/src/pages/BankLines.tsx†L49-L109】
- **Risk:** Privileged data export or deletion executed by unauthorised users.
  - **Mitigation:** Admin routes enforce header-based secrets and short-circuit without the configured token, with unit tests asserting 403 responses for missing credentials.【F:services/api-gateway/src/app.ts†L109-L189】【F:services/api-gateway/test/privacy.spec.ts†L32-L91】
- **Risk:** Leakage of sensitive identifiers through logging or audit trails.
  - **Mitigation:** Error handlers mask sensitive fields before logging, and PII audit events exclude plaintext payloads by design.【F:services/api-gateway/src/app.ts†L103-L107】【F:shared/src/masking.ts†L1-L107】【F:services/api-gateway/test/pii.spec.ts†L82-L106】
