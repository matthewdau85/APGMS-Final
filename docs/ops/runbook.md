# API Gateway Operations Runbook

## Service Overview
- Fastify-based HTTP gateway exposing authenticated APIs.
- Dependencies: Postgres (DATABASE_URL), Redis (if configured), PII KMS providers.

## Start/Stop Procedures
- **Start data services first**: ensure Postgres is listening on `localhost:5432` (or update `DATABASE_URL`/`SHADOW_DATABASE_URL`
  to point at the actual host). `docker compose up -d db redis` brings up the default containers; confirm `docker ps` shows
  `apgms-db` healthy before starting the gateway.
- **Start the gateway**: pnpm --filter @apgms/api-gateway dev
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
2. If DB connectivity is failing, run `docker ps` (or `pg_isready -h localhost -p 5432`) to verify the Postgres container is
   healthy, then run pnpm --filter @apgms/shared exec prisma migrate status to confirm credentials.
3. For repeated auth failures, rotate credentials and review audit logs (AuditLog table).
4. Escalate via on-call Slack/PagerDuty channel.

## Post-Incident
- Record incident in status/README.md with timeline and resolution.
- File follow-up tasks to improve automation or documentation.
- Capture command evidence with `pnpm compliance:evidence --tag <incident-id>` and archive the output in `artifacts/compliance/`.
- Populate `status/incidents/<incident-id>.md` using the template provided to keep public status in sync.
- Run `pnpm backup:evidence-pack -- --base-url http://localhost:3000 --org <org> --token <jwt>` against the affected environment to snapshot export/compliance JSON.
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
- [ ] pnpm k6:smoke -- --env BASE_URL=http://localhost:3000 passes (requires k6).
- [ ] Generate an evidence pack with `curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/compliance/evidence` and confirm it appears in `/compliance/evidence`.
- [ ] `pnpm smoke:regulator` logs in with the regulator access code and exercises `/regulator/*` endpoints end-to-end.

## Troubleshooting

### PrismaClientInitializationError / `Can't reach database server at localhost:5432`
- Symptom: `/compliance/report`, `/admin/export/:org`, or the evidence-pack script return 500s because Prisma cannot connect to Postgres.
- Fix: verify Postgres is running at the host/port defined in `DATABASE_URL`. For the default docker-compose flow run `docker compose up -d db redis` (or re-run to restart). If you're on Windows and the gateway runs outside Docker, confirm a local Postgres service is listening by running `netstat -aon | findstr 5432`. Update `DATABASE_URL` if Postgres is hosted on a different machine.

### `pnpm k6:smoke` reports port 6565 in use
- Symptom: the smoke test runner refuses to start because its metrics listener port is already bound.
- Fix: on Windows run `netstat -aon | findstr 6565`, then `taskkill /PID <PID> /F` for the offending process before re-running the test. On macOS/Linux, use `lsof -i :6565` (or `ss -ltnp 'sport = :6565'`) and kill the listed PID.


See `docs/ops/logging.md` for structured logging guidance.





## Incident Drills
- Quarterly incident rehearsal covering DB outage, auth anomaly, and deployment rollback.
- Record outcomes in `status/README.md` with follow-up tasks.


See docs/ops/alerts.md for alert routing and testing details.
