# APGMS Release Readiness Snapshot (2025-02-15)

## Executive Summary
- **Status**: Blocked. Critical API routes (bank lines, admin data, tax) are never registered in `buildServer`, so authenticated users cannot reach PAYGW/GST workflows.
- **Security posture**: Auth, rate limiting, and CSP/CORS scaffolding exist, but key enforcement (idempotency, org redaction) is incomplete or wired to stubbed logic.
- **Operations**: Health/ready/metrics endpoints exist, yet Prisma instrumentation is disabled because `instrumentPrisma(prisma)` is not assigned back to the exported client.
- **Docs vs. reality**: DPIA/ASVS mappings cite files and metrics (`apgms_auth_failures_total`, admin delete flows) that do not exist, risking compliance drift.

## Top Risks
1. **Banking surface unreachable** – `registerBankLinesRoutes` is never added to the Fastify instance. No PAYGW/GST ledger ingestion can occur. (`services/api-gateway/src/app.ts` lines 200-210)
2. **Stale JS entrypoint** – `src/index.js` imports `createApp()` from `./app`, but the TypeScript module only exports `buildServer()`, leaving runtime inconsistencies. (`services/api-gateway/src/index.js` vs `src/app.ts`)
3. **Observability gap** – `instrumentPrisma(prisma as any);` throws away the extended client; DB timing/metrics are never emitted. (`services/api-gateway/src/app.ts` lines 32-34, `observability/prisma-metrics.ts`)
4. **Documentation inaccuracies** – DPIA and ASVS mappings reference endpoints/metrics that are absent (e.g., `/admin/delete`, `apgms_security_events_total`). (`docs/privacy/dpia.md`, `docs/security/ASVS-mapping.md`, `runbooks/ops.md`)

## Suggested Fixes
- Register the domain routers (`registerBankLinesRoutes`, `registerAdminDataRoutes`, `registerTaxRoutes`) inside `buildServer()` with the correct auth guards.
- Replace `src/index.js` with the TypeScript entry (`src/index.ts`) or export a compatible `createApp` factory.
- Assign `instrumentPrisma(prisma)` back to the exported client (e.g., `export const prisma = instrumentPrisma(new PrismaClient());`).
- Update compliance docs to match implemented behaviour and remove references to non-existent metrics/routes.

