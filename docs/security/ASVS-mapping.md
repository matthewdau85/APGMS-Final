# OWASP ASVS L2 Mapping

## V1: Architecture, Design and Threat Modelling
- JWT verification enforced with RS256 keys, audience/issuer validation, and role scoping (services/api-gateway/src/lib/auth.ts:12).
- Strict, fail-closed CORS allow-list, Helmet CSP/HSTS, and rate limiting across the gateway (services/api-gateway/src/app.ts:224).
- Startup rejects missing JWT/KMS secrets and invalid base64 material (services/api-gateway/src/config.ts:1).

## V2: Authentication
- Bearer tokens verified on every endpoint with replay protection and Argon2id hashed credentials in persistence (services/api-gateway/src/app.ts:73, shared/src/security/password.ts:1).
- Legacy admin flows now require matching org scopes and audit trails (services/api-gateway/src/routes/admin.data.ts:81).

## V3: Session Management
- Request nonce / idempotency keys enforced for POST /bank-lines and guarded replay handling (services/api-gateway/src/app.ts:333).
- Authorization failures tracked via anomaly counters and metrics for downstream alerting (services/api-gateway/src/app.ts:101).

## V4: Access Control
- Org-scoped queries and sanitized responses ensure least privilege for /users and /bank-lines (services/api-gateway/src/app.ts:247).
- Admin exports/deletes validate principal and record play-by-play audit entries (services/api-gateway/src/app.ts:413).

## V6: Cryptography
- Bank line payees/descriptions encrypted with envelope keys and salts managed via KMS provider (shared/prisma/schema.prisma:33, services/api-gateway/src/security/providers.ts:12).
- PII decryption requires audit logger registration and emits tamper-resistant logs (services/api-gateway/src/lib/pii.ts:82).

## V7: Error Handling and Logging
- Structured error responses and masking keep stack data out of responses; logging redacts secrets (services/api-gateway/src/app.ts:96).
- Audit trails stored in AuditLog table with Prometheus counters for security events (shared/prisma/schema.prisma:47, services/api-gateway/src/plugins/metrics.ts:4).

## V10: Malicious Input Handling
- Zod schemas validate body/query payloads for public and admin endpoints with consistent 4xx responses (services/api-gateway/src/app.ts:56).
- Admin delete flow enforces confirmation token and hashed tombstones, reducing accidental data loss (services/api-gateway/src/routes/admin.data.ts:108).

## V14: Configuration
- All secrets supplied via environment variables with sample .env.example documenting required keys and rate limits (.env.example:8).
- Config loader validates URLs, base64 keys, and enforce strong defaults so the service fails closed (services/api-gateway/src/config.ts:1).
- CI checks for Prisma drift and conflict markers to prevent unsafe deployments (.github/workflows/ci.yml:22).

