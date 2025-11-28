# High Availability & Disaster Recovery Plan

## Architecture Summary
- **Regions & Zones**: Active-active deployment across `ap-southeast-2a` and `ap-southeast-2b` with a warm standby in `ap-southeast-2c`.
- **Control plane**: Argo CD manages desired state across clusters, with health enforcement hooks to block drifted manifests.
- **Data layer**: Patroni-managed Postgres with synchronous commit between the two primary AZs and asynchronous streaming to the standby replica. Redis Enterprise provides geo-replication with 30 s sync windows.
- **Messaging**: NATS JetStream mirrors durable streams to both primary AZs; consumers are configured with `deliverPolicy=last` to avoid replaying historical ledgers after failover.

## Automated Failover & Recovery
1. **Kubernetes failover**
   - Cluster Autoscaler plus PodDisruptionBudgets ensure at least 2 API gateway pods remain healthy per AZ.
   - HAProxy health checks hit `/ready`; once two consecutive 503 responses occur, traffic shifts to the other zone within 15 s.
2. **Database failover**
   - Patroni promotes the replica after 10 s of lost heartbeats; the API layer refreshes connection pools automatically.
   - Recovery script `infra/observability/scripts/failover-db.sh` performs the DNS swap and validates `pg_isready` before re-admitting the node.
3. **Redis/NATS**
   - Redis Sentinel handles master election; the worker obtains the new endpoint via Consul watch.
   - NATS streams are restored via `tools/nats/restore-stream.sh`, which replays only the missing offsets recorded in `artifacts/ha/last-stream-offset.json`.

## Backup & Restore
- **Postgres**: Nightly full base backups stored in S3 with 14-day retention; WAL archiving provides point-in-time recovery with 5-minute RPO. Restore tested monthly via `infra/iac/terraform/postgres-restore.tf`.
- **Redis**: Hourly RDB snapshots and continuous AOF replication. Snapshots stored in `s3://apgms-backups/redis/` with server-side encryption.
- **Object storage**: Accounting artifacts copied to a cross-region bucket using S3 replication rules defined in `infra/iac/terraform/artifacts.tf`.

## Disaster Recovery Drills
| Date | Scenario | RTO/RPO Result |
| --- | --- | --- |
| 6 Feb 2025 | Region evacuation (primary AZ loss) | RTO 11 min, RPO < 5 min |
| 20 Feb 2025 | Postgres corruption | RTO 22 min (restore + reindex), RPO 4 min |
| 14 Mar 2025 | Redis failover chaos test | RTO 3 min, RPO 0 (no data loss) |

All drills documented in `artifacts/ha/drills/2025-q1/` with command transcripts and screenshots.

## Load & Failover Testing
- Executed `k6 run k6/scripts/ha-failover.js --vus 600 --duration 15m --stage 1000` against the dual-AZ cluster on 23 March 2025.
- Observed stats:
  - `http_req_failed`: 0.02% (below 0.1% SLA)
  - `http_req_duration`: p95 410 ms (SLA 500 ms) during failover window
  - `custom_metric_ready_state`: no values below 0.95
- Load test report stored at `artifacts/perf/2025-03-ha-failover.html`.

## DR Runbook
1. Declare incident in PagerDuty (service **APGMS Platform**).
2. Follow `runbooks/ops.md#rolling-deploy--graceful-shutdown` until affected zone is drained.
3. Execute `tools/dr/promote-standby.sh <cluster>` to promote the warm standby.
4. Validate:
   - `/health` on all routers
   - `pg_isready -h <primary>`
   - Redis Sentinel `INFO replication`
5. Post-recovery:
   - Run k6 smoke test `pnpm k6:smoke`
   - Update `status/incidents/<id>.md` and attach graphs from `docs/ops/dashboards.md`.

## Compliance & Communication
- DR plan reviewed with the banking partner on 25 March 2025; attestation stored in `artifacts/compliance/dr-plan-signoff.pdf`.
- Quarterly tabletop exercise scheduled (next: 18 June 2025) with attendance tracked in `docs/runbooks/enablement.md`.
