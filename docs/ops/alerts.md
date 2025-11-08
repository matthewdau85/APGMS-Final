# Alerting Guide

## Alertmanager routing
- **availability_fast_burn**: Pages Platform Ops via PagerDuty.
- **availability_slow_burn**: Posts to Slack `#ops` for daytime triage.
- **security_events_total{event="anomaly.auth"} > 0 for 5m**: Notifies Security Engineering for investigation.
- **chaos_drill_test_channel**: Synthetic chaos alerts route to the internal `#chaos-drills` Slack channel so rehearsal noise stays isolated.

## SLO and alert rules
### API latency (Reliability pillar)
- Target: `p95(apgms_http_request_duration_seconds{route!~"/metrics|/ready"}) < 750ms`.
- Alert: `histogram_quantile(0.95, sum by (le,route)(rate(apgms_http_request_duration_seconds_bucket{route!~"/metrics|/ready"}[5m]))) > 0.75` for 10 minutes (warn to `#ops`, page on 30 minutes sustained).

### API error budget (Reliability pillar)
- Metric: `apgms_http_request_errors_total` vs `apgms_http_requests_total`.
- Alert: `increase(apgms_http_request_errors_total[10m]) / increase(apgms_http_requests_total[10m]) > 0.02` for 2 evaluation periods. Routes to PagerDuty with severity **SEV2**.

### Snapshot freshness (Operations pillar)
- Metric: `apgms_monitoring_snapshot_lag_seconds{org_id="*"}`.
- Alert: `max_over_time(apgms_monitoring_snapshot_lag_seconds[15m]) > 900` (15 minutes) alerts to `#ops` and files a task for Compliance Operations.

### Queue backlog safety net (Operations pillar)
- Metric: `apgms_queue_backlog_depth{queue="bas-settlements"}`.
- Alert: `apgms_queue_backlog_depth > 200 for 10m` routes to `#chaos-drills` (synthetic) and mirrors to `#ops` when seen outside rehearsal windows.

## Synthetic chaos drills
- Run `pnpm chaos:dependencies` locally or in CI to rehearse dependency outages.
- The script toggles `/__chaos` endpoints to:
  - Force `/ready` to 503 when the database flag is set.
  - Inflate queue backlog gauges and verify they clear back to zero.
  - Assert that event history records both outage and recovery markers.
- Nightly workflow `Nightly Chaos Smoke` runs the drill; review job logs for `Simulating database outage` and `Queue backlog gauge reset confirmed` entries.
- Alerts triggered during the drill are auto-routed to the `#chaos-drills` Slack test channel. Confirm messages resolve with recovery notes.

## Testing alert rules
1. Use `pnpm chaos:dependencies` to generate readiness failures and backlog spikes; confirm Prometheus receives expected metrics.
2. Run `promtool test rules ops/promql.rules.yml` (once authored) before deploying any changes to alert expressions.
- Follow the API Gateway Operations Runbook for remediation steps once an alert fires.
- Document alert IDs, timestamps, and corrective actions in `status/README.md`.
- After chaos drills, attach evidence from the nightly job and mark the rehearsal complete in the Reliability calendar.
## Runbooks
- Follow API Gateway Operations Runbook for resolution steps.
- Document alert IDs, timestamps, and remediation in status/README.md.
