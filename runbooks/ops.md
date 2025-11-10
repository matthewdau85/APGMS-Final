# Ops Runbook

## Key Endpoints
- /health : liveness. 200 = process is up.
- /ready : readiness. 200 = serving traffic, 503 = not ready (draining or DB down).
- /metrics : Prometheus scrape. Key metrics:
  - apgms_security_events_total{event="anomaly.auth"}
  - apgms_auth_failures_total{orgId="..."}
  - apgms_cors_reject_total{origin="..."}
  - readiness.ok / readiness.fail / readiness.draining events.

## Periodic Security Attestation Checklist
Run this checklist during the first week of each quarter and record outputs in the governance drive.
1. Export quarterly control evidence (monitoring dashboards, audit log digests, incident summaries).
2. Validate forensic log integrity by sampling hashes from the WORM store and matching them to the attestation manifest.
3. Confirm key rotation tickets have been executed for data encryption and signing keys within SLA.
4. Review outstanding security findings and document remediation status in the attestation report template.

## Key Management Cadence
- Schedule customer data key rotations via the KMS automation job (`scripts/kms-rotate.mjs`) every 90 days.
- Signing and infrastructure keys rotate every 180 days; coordinate with platform engineering to avoid downtime.
- Record each rotation in the change management system, attach KMS logs, and link to the quarterly attestation.
- If an emergency rotation occurs, update the patent evidence package with revised key custody statements.

## Forensic Logging Review
- Daily: Verify ingestion success for the `forensic` log stream in the SIEM; alert on any gaps longer than 5 minutes.
- Weekly: Run `pnpm audit:forensics` to reconcile log hashes against the WORM repository manifest.
- Incident: When triggered, snapshot relevant log partitions, store them in the incident bucket, and document chain-of-custody in the NDB runbook.

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
