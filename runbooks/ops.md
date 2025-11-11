# Ops Runbook

## Key Endpoints
- `/health` - liveness. Returns 200 when the process is up.
- `/ready` - readiness. Returns 200 only when Postgres plus any configured Redis/NATS dependencies respond; returns 503 (with component detail) while draining or if a dependency is down.
- `/metrics` - Prometheus scrape point. Exposes `apgms_http_requests_total`, `apgms_http_request_duration_seconds`, `apgms_db_query_duration_seconds`, `apgms_db_queries_total`, and `apgms_job_duration_seconds` (`services/api-gateway/src/observability/metrics.ts`).
- `/bank-lines` - authenticated PAYGW/GST ingestion. Requires JWT + allowed role; GET lists caller-org lines, POST accepts ciphertext payloads.
- `/admin/data` - authenticated stub for admin datasets. In-memory only; used for smoke validation of auth plumbing, not for real exports.
- `/tax/health` - authenticated proxy that pings the configured tax engine URL with a short timeout for observability.

## Auth & Routing Notes
- `buildServer` now registers `/bank-lines`, `/admin/data`, and `/tax/*` inside a Fastify scope that attaches `authGuard`, so every domain route receives `request.user` populated before its own role/policy checks run (`services/api-gateway/src/app.ts`).
- The admin/tax routers still invoke `authenticateRequest` for audit metrics; ensure `AUTH_JWKS`, `AUTH_AUDIENCE`, and `AUTH_ISSUER` are present in every deployment so those hooks succeed.

## Common Alerts
- Surge in `apgms_http_request_duration_seconds` or `apgms_http_requests_total{status="5xx"}` indicates upstream latency or crash loops; validate `/ready` and inspect Fastify logs with trace IDs.
- Non-zero `apgms_db_query_duration_seconds` p95 above baseline usually means Postgres contention; check slow query logs and Prisma instrumentation.
- If `/tax/health` returns 502, the upstream tax engine URL configured in `TAX_ENGINE_URL` is unreachable or returning non-2xx responses.

## Data Handling Caveats
- There is no automated subject deletion/export flow. For right-to-erasure or evidence requests, involve the compliance team and run manual SQL/audit procedures; document every step until the API gains durable routes.
- `/admin/data` is intentionally ephemeral - do not rely on it for long-lived admin artifacts.

## Rolling Deploy / Graceful Shutdown
- `SIGTERM` sets `draining=true`, causing `/ready` to flip to 503 so the load balancer can drain the instance.
- Fastify waits for inflight requests before closing; keep the pod alive until `/ready` reports `{ ok: false, draining: true }` for at least one scrape interval.

## Regulator Access
- Only the regulator auth/session bootstrap is wired today. Evidence catalogue, monitoring snapshots, and bank summary routes remain TODO; direct auditors to the compliance backlog for progress before promising those controls.





