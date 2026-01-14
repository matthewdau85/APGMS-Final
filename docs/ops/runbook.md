# API Gateway Operations Runbook

## Service Overview
- Fastify-based HTTP gateway exposing authenticated APIs.
- Dependencies: Postgres (DATABASE_URL), Redis (if configured), PII KMS providers.

## Start/Stop Procedures
- **Start**: pnpm --filter @apgms/api-gateway dev
- **Graceful shutdown**: send SIGTERM/SIGINT; handler drains and calls fastify.close() (services/api-gateway/src/index.ts).
- Verify shutdown by checking logs api-gateway shut down cleanly.

## Health & Readiness
- GET /health returns { ok: true } - liveness only.
- GET /ready performs DB connectivity check; returns 503 on failure.
- GET /regulator/health exposes the read-only portal health (same process, but logged separately for regulator traffic probes).

## Readiness & security chain

- `pnpm readiness:chain` executes the staged workflow defined in `scripts/readiness/run-readiness-chain.sh` (sbom → gitleaks → trivy → validate:ato → test:a11y → run-all-tests).
- Resume from any stage via `pnpm readiness:chain -- --from <stage>` or list the stages with `pnpm readiness:chain -- --list`.
- Logs land under `artifacts/readiness-logs/<timestamp>/<stage>.log` so you can inspect failures or rerun a single stage with the same arguments.
- `pnpm readiness:all` runs `scripts/readiness/all.cjs` and will wait for `/ready` to return 200 (retrying on transient 503s) before concluding the availability pillar; rerun it after deployments to verify all pillars pass.
- Security tooling reminders: `pnpm run sbom`, `pnpm run gitleaks`, `pnpm run trivy`, and `pnpm sca` (`pnpm audit --audit-level=high`) are part of the readiness/security sweep; rerun them when dependencies change and document any TODOs for known issues (e.g., `qs@6.14.0`, `@remix-run/router@1.23.0`).
- Use `scripts/readiness/README-DB-READY.txt` for a step-by-step checklist (compose status, DB logs, curl `/ready`, rerun scans) and the optional `./scripts/readiness/run-db-ready.sh` helper when your stack is already running.

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


See `docs/ops/logging.md` for structured logging guidance.





## Incident Drills
- Quarterly incident rehearsal covering DB outage, auth anomaly, and deployment rollback.
- Record outcomes in `status/README.md` with follow-up tasks.


See docs/ops/alerts.md for alert routing and testing details.
