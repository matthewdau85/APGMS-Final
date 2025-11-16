# Dashboards

## User-Facing Obligations Dashboard
- **PAYGW & GST tiles** show current balance, forecasted liability, and buffer coverage. Data originates from `/compliance/status` and refreshes every 60 seconds via SSE.
- **Forecast tier widget** surfaces tier (`steady`, `watch`, `escalate`) with inline tooltips summarising triggers. UAT sign-off captured in `artifacts/ux/2025-03-dashboard-uat.pdf`.
- **Upcoming BAS deadlines** timeline reads from the reminders service; overdue lodgments flip the tile to amber/red and emit a Slack webhook.
- **Discrepancy alerts** card lists unresolved PAYGW/GST differences, queue length, and recommended remediation steps. Links deep-link to `/compliance/alerts/:id` for closure evidence.
- **Accessibility**: All widgets meet WCAG 2.1 AA contrast; screen-reader labels live in `webapp/src/modules/obligations/i18n.ts`.

## Operational Health Dashboard
- **System health grid** renders readiness/liveness from `/ready` and `/health` probes aggregated per AZ.
- **Queue depth panel** monitors worker queues (PAYGW ingest, GST ingest, reconciliation) using `apgms_queue_depth` metrics; alert thresholds at 5k, 10k, 20k.
- **Error rate timeline** plots `apgms_http_requests_total{status="5.."}` alongside `apgms_job_failures_total` to quickly correlate API and worker failures.
- **Resource saturation** tiles for CPU, memory, Redis ops/sec, and Postgres replication lag (target < 200 ms). Prometheus rules page these via PagerDuty.
- **Deployment status** row integrates Argo CD Application health and recent CI pipelines (GitHub Actions `deploy-main` workflow); failed stages link directly to the pipeline run.

## Prometheus/Grafana Panels
- **Request volume**: Chart `sum by (route) (rate(apgms_api_requests_total[5m]))` to spot traffic spikes per Fastify route.
- **Error ratio**: Single-stat on `sum(rate(apgms_api_requests_total{status=~"5.."}[5m])) / sum(rate(apgms_api_requests_total[5m]))`.
- **Readiness failures**: Alert on `sum_over_time((probe_success == 0)[15m])` or scrape gaps. Pair with `/ready` probe in blackbox exporter.
- **Auth anomalies**: Track `sum(rate(apgms_api_requests_total{route="/alerts/:id/resolve",status="401"}[5m]))` to catch repeated MFA denials.

## Publishing & Access
- Dashboards hosted in Grafana (`ops.grafana.apgms.io`) and embedded in the React app under **Insights → Obligations**.
- Config JSON exports stored in `artifacts/dashboards/` for change control; reference `artifacts/dashboards/2025-03-pilot-grafana.json` for the latest user view.
- Near-real-time requirement met via SSE updates (max 5-second lag) and Prometheus scrape interval of 15 seconds for ops panels.
- Ops team validated dashboard accuracy during March pilot; approvals recorded in `status/pilots/2025-03-live-trials.md`.
