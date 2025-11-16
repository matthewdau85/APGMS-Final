# Ops Runbook

## Key Endpoints
- `/health` - liveness. Returns 200 when the process is up.
- `/ready` - readiness. Returns 200 only when Postgres plus any configured Redis/NATS dependencies respond; returns 503 (with component detail) while draining or if a dependency is down.
- `/metrics` - Prometheus scrape point. Exposes `apgms_http_requests_total`, `apgms_http_request_duration_seconds`, `apgms_db_query_duration_seconds`, `apgms_db_queries_total`, and `apgms_job_duration_seconds` (`services/api-gateway/src/observability/metrics.ts`).
- `/bank-lines` - authenticated PAYGW/GST ingestion. Requires JWT + allowed role; GET lists caller-org lines, POST accepts ciphertext payloads.
- `/admin/data` - authenticated stub for admin datasets. In-memory only; used for smoke validation of auth plumbing, not for real exports.
- `/tax/health` - authenticated proxy that pings the configured tax engine URL with a short timeout for observability.

## Dependency checks before bring-up
- Confirm the default containers are running (or point the env vars at reachable services):
  - `docker compose up -d db redis` exposes Postgres on `localhost:5432` and Redis on `localhost:6379`.
  - If you rely on external infrastructure, export `DATABASE_URL`, `SHADOW_DATABASE_URL`, and `REDIS_URL` with those hosts before starting the gateway.
- Sanity check connectivity **before** launching `pnpm --filter @apgms/api-gateway dev`:
  - `pg_isready -h <host> -p 5432` (or `psql "$DATABASE_URL" -c "select 1"`) must succeed or Prisma will raise `PrismaClientInitializationError: Can't reach database server` on `/compliance/report`, `/admin/export/:org`, etc.
  - `redis-cli -u $REDIS_URL ping` (or `redis-cli -h localhost -p 6379 ping`) must return `PONG`; otherwise Fastify will log `redis_client_error` for every request that touches rate limits/session stores.
- Restart the gateway after changing any of these endpoints so Fastify picks up the new sockets.

## Start/Stop Procedures
- **Start**: `pnpm --filter @apgms/api-gateway dev`.
- Ensure Postgres is listening on `localhost:5432` (or that `DATABASE_URL`/`SHADOW_DATABASE_URL` point to the actual host) before running the start command. Bringing up the default `db`/`redis` containers via `docker compose up -d db redis` and confirming `docker ps` shows `apgms-db` healthy is the recommended flow.
- **Graceful shutdown**: send SIGTERM/SIGINT; the handler drains and calls `fastify.close()` (`services/api-gateway/src/index.ts`). Verify shutdown by checking the logs for an `api-gateway shut down cleanly` line.

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

- **Compliance Monitoring & Designated Accounts**
- Payroll/POS ingestion now channels data into `PayrollContribution` and `PosTransaction` via `/ingest/payroll` and `/ingest/pos` (use Idempotency-Key headers). The nightly worker applies these rows to the `PAYGW_BUFFER`/`GST_BUFFER` ledgers and validates balances using `ensureDesignatedAccountCoverage` (`shared/src/ledger/designated-account.ts`), raising `DESIGNATED_FUNDS_SHORTFALL` alerts when requirements exceed available funds.
- `/compliance/precheck`, `/compliance/status`, `/compliance/pending`, and `/compliance/reminders` expose readiness, buffer snapshots, pending contributions, and guidance for remediation. Use these endpoints to re-ingest missing batches, rerun the reconciliation job, and capture the proof in the audit log before notifying the business or the ATO.
- When the shortfall alert resolves, call `/compliance/alerts/:id/resolve`, log the remediation evidence, and file it under `artifacts/compliance/` (include OSF exports, correspondence, adapter plans). Automated reminders should flag upcoming BAS deadlines and penalties while the system records remission/payment-plan conversations.

- **Regulatory Status**
- Track the ATO DSP OSF questionnaire, product registration, AUSTRAC/ASIC discussions, and the ADI/banking partner plan inside `docs/runbooks/admin-controls.md` (or a dedicated `status/` note). Keep copies of submissions/contracts in `artifacts/compliance/` so the legal team can show evidence when auditors arrive.
- **Partnering & Pilots**
- After you select a banking partner/adaptor, configure `DESIGNATED_BANKING_URL`/`DESIGNATED_BANKING_TOKEN` (or call `configureBankingAdapter`) so the ledger queries the sandbox endpoint. Record the partner’s API spec, certificate chain, and test accounts in `artifacts/compliance/`.
- Log the DSP Product ID, OSF questionnaire ID, and AUSTRAC/ASIC/AFSL path within the compliance dashboard and runbook. Run pilots by feeding payroll/POS batches through `/ingest/*`, calling `/compliance/precheck`, and capturing alert resolution evidence via `/compliance/status` + `/compliance/alerts/:id/resolve`. Document each pilot organisation, payload trace, precheck response, and resolution timeline for audit reviewers.
- **Innovation Signals**
- `/compliance/status` adds `forecast` and `tierStatus` so you can treat the forecasted obligations as “virtual balances” and trigger warnings when the tier drops to `escalate`. Surface these signals on your dashboard/alerting playbooks to flag unusual shortfalls before BAS lodgment.
- Log the heuristic you use for `forecastObligations`/`computeTierStatus` so regulators can understand the predictive engine even if it’s just historical averages; store the tuning notes in `artifacts/compliance/`.
