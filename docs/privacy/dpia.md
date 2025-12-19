# Data Protection Impact Assessment

## Overview
- **Processing**: APGMS ingests organisation metadata, admin user accounts, and ciphertext summaries of bank-line movements. Plaintext conversion is performed by clients; the API stores only the encrypted fields that are supplied.
- **Lawful basis**: Customer contracts plus TFN handling consent; audit logging captures minimal metadata for compliance evidence.

## Data Inventory & Flow
- User credentials are hashed with bcrypt via `verifyCredentials` before comparison and are never stored or logged in plaintext (`services/api-gateway/src/auth.ts`).
- `/bank-lines` accepts ciphertext for payee/description fields and persists them verbatim; only redacted metadata is returned to callers (`services/api-gateway/src/routes/bank-lines.ts`).
- Auth and regulator actions append entries through `recordAuditLog`, providing actor, action, and timestamps in the shared Prisma schema (`services/api-gateway/src/lib/audit.ts`, `infra/prisma/schema.prisma`).

## Risk Assessment
- **Unauthorised access**: Fastify `authGuard` enforces HS256 JWTs with issuer/audience validation and populates `request.user`, while `assertOrgAccess` and `assertRoleForBankLines` ensure requests stay within the caller's org and role (`services/api-gateway/src/auth.ts`, `services/api-gateway/src/utils/orgScope.ts`).
- **Data leakage**: Bank-line responses intentionally drop ciphertext fields, but the admin data route is an in-memory stub and will lose context across restarts; sensitive exports are therefore not yet supported and are flagged as a compliance gap.
- **Key compromise**: Encryption keys, redis/nats URLs, and JWT secrets are validated through the config loader which enforces encoding, length, and URL constraints before boot succeeds (`services/api-gateway/src/config.ts`).

## Controls & Monitoring
- Helmet CSP, deny-by-default CORS, and rate limiting are installed on every request path in `buildServer`.
- `/bank-lines` enforces idempotency keys (`orgId_idempotencyKey` constraint) and emits `idempotent-replay` headers to simplify replay detection.
- `/metrics` exposes the actual Prometheus counters and histograms available today: `apgms_http_requests_total`, `apgms_http_request_duration_seconds`, `apgms_db_query_duration_seconds`, `apgms_db_queries_total`, and `apgms_job_duration_seconds` (`services/api-gateway/src/observability/metrics.ts`).
- Health/readiness endpoints run direct Postgres/Redis/NATS checks before advertising readiness so resiliency tooling can gate deployments.

## Residual Risk & Actions
- The admin deletion/export workflows described in older guidance are not implemented; all such requests must go through manual support until a durable route is delivered (tracked in the compliance backlog).
- Regulator evidence routes beyond authentication are still TODO. DPIA reviewers should verify the backlog before closing audits.
- Re-review this DPIA whenever new data categories are introduced or after significant auth/ledger changes.
