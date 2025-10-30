# Ops Runbook

## Key Endpoints
- /health : liveness. 200 = process is up.
- /ready : readiness. 200 = serving traffic, 503 = not ready (draining or DB down).
- /metrics : Prometheus scrape. Key metrics:
  - apgms_security_events_total{event="anomaly.auth"}
  - apgms_auth_failures_total{orgId="..."}
  - apgms_cors_reject_total{origin="..."}
  - readiness.ok / readiness.fail / readiness.draining events.

## Common Alerts
- High apgms_auth_failures_total => possible credential stuffing
- readiness.fail spike => DB connectivity issue, check Postgres
- cors.reject spike => misconfigured frontend origin or abuse

## Secure Deletion Flow
- DELETE /admin/delete/:orgId
- Confirms principal.orgId === :orgId
- Soft-deletes org (sets deletedAt), wipes users and bankLines, writes tombstone in orgTombstone.

How to show auditors:
1. Call /admin/export/:orgId before deletion to capture org snapshot.
2. After deletion, confirm tombstone exists and org is marked deleted.
3. Show audit log entries with action=admin.org.delete including timestamp, actor, orgId.

## Rolling Deploy / Graceful Shutdown
- SIGTERM sets draining=true
- /ready returns 503 {draining:true}
- app.close() waits for inflight requests then exits
- No new traffic should hit draining instances

## Incident Response
- For anomaly.auth spikes: confirm source IPs and affected routes. If suspicious, block at ingress/WAF.
- For cors.reject spikes: validate CORS_ALLOWED_ORIGINS env, update config if a legitimate frontend was added.

## Regulator Portal Checks
- The read-only regulator surfaces live at `/regulator/*`; health probe is `/regulator/health`.
- Run `pnpm smoke:regulator` (requires API running locally plus `REGULATOR_ACCESS_CODE` if non-default) to exercise login, evidence catalogue, compliance report, monitoring snapshots, and bank summary.
- Evidence payload hashes can be verified via UI (Regulator > Evidence Library > "Verify hash") or with the CLI using `node scripts/regulator-smoke.mjs` and third-party tooling.
- If smoke fails, inspect audit log entries `regulator.login` and `regulator.monitoring.list` to confirm the access attempt was recorded.
