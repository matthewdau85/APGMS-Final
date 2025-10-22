# Operations Runbook

## Service Overview

The platform consists of a React web application, background workers, and a set of Node.js-based microservices
orchestrated via Kubernetes. Managed PostgreSQL and Redis clusters provide persistence. Traffic is routed
through an API gateway with integrated WAF and rate limiting.

## Health Checks

| Component | Check | Endpoint / Command | Expected Response |
| --- | --- | --- | --- |
| API Gateway | Liveness | `https://<tenant>.api.example.com/healthz` | HTTP 200 with `{ "status": "ok" }`. Latency <200ms. |
| Web App | Synthetic | `npm run test:e2e -- --spec health.spec.ts` against staging | All scenarios pass; Lighthouse score >90. |
| Worker | Queue depth | `kubectl exec worker -- node scripts/queue-health.js` | Queue depth < 100 messages and processing rate stable. |
| PostgreSQL | Connectivity | `pg_isready -h <host>` | Returns `accepting connections`. |
| Redis | Ping | `redis-cli -h <host> ping` | Returns `PONG`. |
| Third-party Integrations | API quota | Scheduled Lambda check hitting `/status` for each integration | 2xx response; quota usage <80%. |

Health checks run continuously via Prometheus blackbox exporter and internal synthetic monitoring. On failure,
alerts route to the on-call channel with relevant diagnostics.

## Metrics & Observability

* **Availability:** `service_uptime_percentage` SLI measured over 1-hour windows.
* **Latency:** `http_request_duration_seconds` histogram with SLO p95 < 300ms for core APIs.
* **Error Rate:** `http_requests_total{status=~"5.."}` aggregated per service.
* **Business KPIs:** `active_users`, `reports_generated_total`, `billing_failures_total`.
* **Infrastructure:** CPU, memory, and pod restart counts via kube-state-metrics.

Dashboards live in Grafana (`Ops / Platform Overview`, `Ops / Billing`, `Ops / Workers`). Alerts are configured in
Alertmanager with severity levels `info`, `warning`, and `critical`. Critical alerts page the on-call engineer via
PagerDuty.

## Deployment Expectations

1. **Change Management:** All changes go through Git-based review with mandatory CI passing. High-risk changes
   require CAB approval during weekly change window (Wednesdays 16:00 UTC).
2. **Pre-Deployment Checklist:**
   * Verify `main` branch is green in CI.
   * Confirm database migrations reviewed and backward-compatible.
   * Ensure feature flags default to `off` for new features.
3. **Deployment Steps:**
   * `pnpm install --frozen-lockfile`
   * `pnpm run build`
   * `pnpm run deploy -- --env=<staging|prod>` (invokes ArgoCD sync)
   * Monitor rollout via `kubectl rollout status deployment/<service>`
4. **Post-Deployment Verification:**
   * Check Grafana deployment dashboard for error/latency regressions.
   * Run smoke tests: `pnpm run test:smoke -- --env=<env>`.
   * Confirm synthetic monitoring passes.

Failed deployments must be rolled back using `pnpm run deploy -- --env=<env> --rollback` followed by verification
checks above.

## Incident Response

1. **Detection & Triage**
   * Alerts are ingested in PagerDuty and Slack `#ops-alerts` channel.
   * On-call acknowledges within 5 minutes, assesses severity (SEV1–SEV4) using runbook criteria.
2. **Containment**
   * For SEV1/SEV2, freeze deployments via ArgoCD `app suspend`.
   * Capture timeline in incident document (Notion template).
   * Apply mitigations (scale up replicas, failover to standby, feature flag disable) as needed.
3. **Communication**
   * Internal updates every 15 minutes in `#incident-room` Slack channel.
   * Customer communications for SEV1/SEV2 managed via Statuspage and email templates.
4. **Resolution**
   * Validate service health via health checks and key metrics returning to baseline.
   * Remove mitigations gradually and resume deployments after approval.
5. **Post-Incident Review**
   * Conduct blameless RCA within 5 business days.
   * File follow-up actions in Jira with owners and due dates.
   * Update runbook, alerts, or tests based on lessons learned.

Escalation path: On-call engineer → Secondary on-call → Engineering Manager → VP Engineering / Incident Commander.
