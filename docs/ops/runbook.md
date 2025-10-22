# API Gateway Operations Runbook

## Service Overview
- Fastify-based HTTP gateway exposing authenticated APIs.
- Dependencies: Postgres (DATABASE_URL), Redis (if configured), PII KMS providers.

## Start/Stop Procedures
- **Start**: pnpm --filter @apgms/aapi-gateway dev
- **Graceful shutdown**: send SIGTERM/SIGINT; handler drains and calls fastify.close() (services/aapi-gateway/src/index.ts).
- Verify shutdown by checking logs api-gateway shut down cleanly.

## Health & Readiness
- GET /health returns { ok: true } - liveness only.
- GET /ready performs DB connectivity check; returns 503 on failure.

## Logs & Correlation
- Structured logs emitted with JSON, request IDs attached in Fastify hooks (services/aapi-gateway/src/app.ts).
- Security events & audit trails log under security_event and audit_failed.
- Search by x-request-id header.

## Metrics
- Prometheus endpoint at /metrics exposing http_requests_total, security_events_total.
- Check anomaly counter anomaly.auth for repeated auth failures.

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

## Contact
- Primary: Platform Ops (ops@apgms.example)
- Secondary: Security Engineering (security@apgms.example)

## Smoke Test Checklist
- [ ] `pnpm --filter @apgms/aapi-gateway dev` boots, logs listening message.
- [ ] `curl http://localhost:3000/ready` returns 200 under normal conditions.
- [ ] Kill process with CTRL+C and confirm graceful shutdown log.
- [ ] Bring DB down, `/ready` returns 503.
- [ ] `curl http://localhost:3000/metrics` outputs Prometheus counters.


See `docs/ops/logging.md` for structured logging guidance.





## Incident Drills
- Quarterly incident rehearsal covering DB outage, auth anomaly, and deployment rollback.
- Record outcomes in `status/README.md` with follow-up tasks.


