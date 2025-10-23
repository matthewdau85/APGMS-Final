# Dashboards

## Prometheus/Grafana Panels
- **Request rate & latency**: Import `http_requests_total` and `http_request_duration_seconds` using PromQL queries in docs/ops/promql.md.
- **Readiness failures**: Panel on `increase(security_events_total{event="readiness.fail"}[15m])` for sustained issues.
- **Auth anomalies**: Visualise `increase(security_events_total{event="anomaly.auth"}[5m])` with single-stat alarms.

Store exported dashboards in `artifacts/dashboards/` for versioned sharing.
