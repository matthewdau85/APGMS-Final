# API Gateway Operations Runbook

## Service Overview
- Fastify-based HTTP gateway exposing authenticated APIs.
- Dependencies: Postgres (DATABASE_URL), Redis (if configured), PII KMS providers.

### Dependency checks before bring-up
- Confirm the default containers are running (or point the env vars at reachable services):
  - `docker compose up -d db redis` exposes Postgres on `localhost:5432` and Redis on `localhost:6379`.
  - If you rely on external infrastructure, export `DATABASE_URL`, `SHADOW_DATABASE_URL`, and `REDIS_URL` with those hosts before starting the gateway.
- Sanity check connectivity **before** launching `pnpm --filter @apgms/api-gateway dev`:
  - `pg_isready -h <host> -p 5432` (or `psql "$DATABASE_URL" -c "select 1"`) must succeed or Prisma will raise `PrismaClientInitializationError: Can't reach database server` on `/compliance/report`, `/admin/export/:org`, etc.
  - `redis-cli -u $REDIS_URL ping` (or `redis-cli -h localhost -p 6379 ping`) must return `PONG`; otherwise Fastify will log `redis_client_error` for every request that touches rate limits/session stores.
- Restart the gateway after changing any of these endpoints so Fastify picks up the new sockets.

## Start/Stop Procedures
- **Start**: pnpm --filter @apgms/api-gateway dev
- **Graceful shutdown**: send SIGTERM/SIGINT; handler drains and calls fastify.close() (services/api-gateway/src/index.ts).
- Verify shutdown by checking logs api-gateway shut down cleanly.

## Health & Readiness
- GET /health returns { ok: true } - liveness only.
- GET /ready performs DB connectivity check; returns 503 on failure.
- GET /regulator/health exposes the read-only portal health (same process, but logged separately for regulator traffic probes).

## Logs & Correlation
- Structured logs emitted with JSON, request IDs attached in Fastify hooks (services/api-gateway/src/app.ts).
- Security events & audit trails log under security_event and audit_failed.
- Search by x-request-id header.

## Metrics
- Prometheus endpoint at `/metrics` exposes `apgms_api_requests_total{method,route,status}` plus the default `prom-client` process/runtime gauges.
- Alert on unexpected growth in `apgms_api_requests_total{status="5xx"}` or missing scrapes.
- Check anomaly counter `apgms_api_requests_total{route="/alerts/:id/resolve",status="401"}` for MFA denials and repeated auth failures.

## Alerts & SLOs
- Targets: 99.5% availability, p95 latency < 500ms on /bank-lines.
- Burn-rate alerts: fast (1h) & slow (6h) availability SLO breaches (see `docs/ops/promql.md`).
- Alert triggers on readiness flaps (>=3 failures/5m) and anomaly auth events.
- Monitor `security_events_total{event="anomaly.auth"}` and audit failures.

## Incident Response
1. Confirm scope from /metrics and logs.
2. If DB connectivity is failing, run pnpm --filter @apgms/shared exec prisma migrate status and verify credentials.
3. For repeated auth failures, rotate credentials and review audit logs (AuditLog table).
4. Escalate via on-call Slack/PagerDuty channel.

## Post-Incident
- Record incident in status/README.md with timeline and resolution.
- File follow-up tasks to improve automation or documentation.
- Capture command evidence with `pnpm compliance:evidence --tag <incident-id>` and archive the output in `artifacts/compliance/`.
- Populate `status/incidents/<incident-id>.md` using the template provided to keep public status in sync.
- Run `pnpm backup:evidence-pack -- --base-url http://localhost:3000 --org <org> --token <jwt>` against the affected environment to snapshot export/compliance JSON; this CLI calls `/admin/export/<org>` and `/compliance/report` in parallel, so the database **must** be reachable or you will repeat the Prisma/ECONNREFUSED failures seen in the Fastify logs. Re-run the command after database/Redis restarts to capture a clean artifact.
- Run applicable chaos experiment from `docs/ops/chaos.md` after remediation to validate fixes.

## Contact
- Primary: Platform Ops (ops@apgms.example)
- Secondary: Security Engineering (security@apgms.example)

## Smoke Test Checklist
- [ ] `pnpm --filter @apgms/api-gateway dev` boots, logs listening message.
- [ ] `curl http://localhost:3000/ready` returns 200 under normal conditions.
- [ ] `curl http://localhost:3000/regulator/health` returns 200 to prove regulator portal guard rails are active.
- [ ] Kill process with CTRL+C and confirm graceful shutdown log.
- [ ] Bring DB down, `/ready` returns 503.
- [ ] curl http://localhost:3000/metrics outputs Prometheus counters.
- [ ] pnpm k6:smoke -- --env BASE_URL=http://localhost:3000 passes (requires k6). If k6 logs an "address already in use" warning for port 6565, run `netstat -aon | findstr 6565` (Windows) or `lsof -i :6565` (macOS/Linux) and `taskkill /PID <pid> /F` (or `kill -9 <pid>`) before rerunning the smoke.
- [ ] Generate an evidence pack with `curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/compliance/evidence` and confirm it appears in `/compliance/evidence`. Follow up by running `pnpm backup:evidence-pack -- --token=$TOKEN` to exercise the `/admin/export/<org>` + `/compliance/report` proxy routes end-to-end; failures here usually mean Postgres/Redis are offline or `DATABASE_URL` is still pointing at `localhost` while the DB lives elsewhere.
- [ ] `pnpm smoke:regulator` logs in with the regulator access code and exercises `/regulator/*` endpoints end-to-end.


See `docs/ops/logging.md` for structured logging guidance.





## Incident Drills
- Quarterly incident rehearsal covering DB outage, auth anomaly, and deployment rollback.
- Record outcomes in `status/README.md` with follow-up tasks.


See docs/ops/alerts.md for alert routing and testing details.
