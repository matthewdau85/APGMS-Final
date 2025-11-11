# OWASP ASVS L2 Mapping

## V1: Architecture, Design and Threat Modelling
- Fastify `authGuard` verifies HS256 JWTs with issuer/audience checks before attaching `request.user`, and `buildServer` registers all PAYGW/GST routers behind that guard (`services/api-gateway/src/auth.ts`, `services/api-gateway/src/app.ts`).
- Configuration loading fails closed when required env vars, URLs, or key material are missing or malformed, preventing the gateway from starting with partial secrets (`services/api-gateway/src/config.ts`).

## V2: Authentication
- Administrative sign-in flows hash credentials with bcrypt and compare using constant-time checks; bearer tokens are validated on every request via `authGuard` plus per-route MFA/session guards (`services/api-gateway/src/auth.ts`).
- Regulator auth routes reuse the same JWT validation pipeline and insert regulator session metadata before downstream handlers (`services/api-gateway/src/routes/regulator-auth.ts`).

## V3: Session Management
- `/bank-lines` enforces org-scoped idempotency keys and sends `idempotent-replay` headers so clients can safely retry writes without duplication (`services/api-gateway/src/routes/bank-lines.ts`).
- Graceful shutdown toggles a draining flag so `/ready` returns 503 before the process closes, ensuring no new traffic is routed to a terminating instance (`services/api-gateway/src/index.ts`, `services/api-gateway/src/app.ts`).

## V4: Access Control
- `assertOrgAccess` and `assertRoleForBankLines` gate domain routes by org and approved roles, returning explicit 401/403 responses for callers outside their scope (`services/api-gateway/src/utils/orgScope.ts`).
- Admin/tax routers run under the same authenticated scope, reusing `authGuard` to guarantee requests include verified identity context before their own role checks (`services/api-gateway/src/app.ts`).

## V6: Cryptography
- Bank-line payloads keep ciphertext-only fields and key identifiers so decryption happens outside the gateway; the API never emits decrypted payee or description data (`services/api-gateway/src/routes/bank-lines.ts`).
- Encryption and JWT key material is loaded from environment variables and validated for length/encoding at startup (`services/api-gateway/src/config.ts`).

## V7: Error Handling and Logging
- A central error handler maps domain errors to structured JSON without leaking stack traces, and warnings/errors are logged with trace IDs when available (`services/api-gateway/src/app.ts`).
- `recordAuditLog` persists actor/action metadata for auth, regulator, and security-sensitive flows, supporting tamper-resistant evidence trails (`services/api-gateway/src/lib/audit.ts`).

## V10: Malicious Input Handling
- Public routes such as `/bank-lines` validate payloads with Zod schemas and return consistent 4xx responses when validation fails (`services/api-gateway/src/routes/bank-lines.ts`).
- Auth/registration flows call `parseWithSchema` helpers at the transport edge before touching downstream systems (`services/api-gateway/src/app.ts`, `services/api-gateway/src/routes/auth.ts`).

## V14: Configuration
- `.env` requirements are documented in `config.ts` and enforced via helper validators that reject empty values, invalid URLs, or non-base64 keys.
- CI runs Prisma migrate status and fails when schema drift or missing migrations are detected, preventing mismatched deployments (`.github/workflows/ci.yml`).
