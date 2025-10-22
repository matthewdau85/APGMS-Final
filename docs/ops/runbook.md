# Ops runbook

## Service endpoints
- **/health** – lightweight liveness probe returning `{ ok: true }` when the process is accepting traffic.
- **/ready** – runs dependency checks for Postgres (`SELECT 1`), Redis (TCP dial if `REDIS_URL` is set), and the managed OTLP collector health endpoint. Failures surface as `503` with a dependency breakdown so orchestrators can pull the pod from rotation.
- **/metrics** – Prometheus scrape endpoint exposing default Node.js metrics along with `api_http_requests_total` and `api_http_request_duration_seconds` for per-route insight.
 - **/metrics** – Prometheus scrape endpoint exposing default Node.js metrics plus `api_http_requests_total`, `api_http_request_duration_seconds`, SLO gauges (`api_slo_*`), and load-shedding state so Alertmanager can page on error budget burn.
- **Tracing** – each request emits OpenTelemetry spans (`http.server` + Prisma client spans). By default the service ships traces to the managed collector at `https://telemetry.apgms.cloud/v1/traces`; override with `OTEL_TRACES_EXPORTER=memory` for tests or set `OTEL_EXPORTER_OTLP_ENDPOINT` for another target.

## Request correlation
- All inbound requests honour an incoming `x-request-id`/`x-correlation-id` header (or generate one) and echo the identifier back on responses.
- Correlation IDs are injected into structured logs and span attributes as `http.request_id` so logs, metrics, and traces can be cross-referenced quickly.

## Shutdown procedure
The API gateway traps `SIGINT` and `SIGTERM`, logs the signal, and drains in-flight requests by calling `app.close()` before exiting. No manual intervention is required; orchestrators can rely on signal-based shutdown.

## Database connections
Prisma connections are disposed during Fastify shutdown. After deployments or manual restarts, no additional cleanup steps are necessary.

## Load shedding
Write-heavy routes (`POST`, `PATCH`, `PUT`, `DELETE`) are automatically shed while dependency brownouts are detected. The controller watches readiness/dependency errors and serves `503 load_shedding` responses with a `Retry-After` hint until the circuit cools down. Read-only traffic continues to flow so operators can monitor the system and complete investigations.

## Alerting & SLOs
Prometheus scrapes power the following alert rules:

- `api_slo_error_budget_remaining` (ratio) backs an availability burn-rate alert with a 1-hour (fast burn) and 6-hour (slow burn) window at a 99.5% target.
- `api_slo_latency_p95_seconds` is compared against the `api_slo_latency_target_seconds` gauge to raise latency alerts when the 95th percentile exceeds 500 ms.
- `api_load_shedding_active` drives a WARN channel, prompting operators to review dependency dashboards.

Alert routing is configured in PagerDuty via the `apgms-api` service profile.

## Schema drift guard
CI runs `pnpm --filter @apgms/shared prisma:status` against a managed Postgres service with `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`. Pipelines fail fast if pending migrations or drift is detected, keeping production and code schemas aligned.

## Synthetic probes
The CI workflow executes `pnpm --filter @apgms/api-gateway test:synthetic`, which boots the API gateway with representative fixtures and exercises the `/auth/login`, `/users`, and `/bank-lines` flows via HTTP. Failures block deployment, giving early signal that user-critical journeys have regressed.
