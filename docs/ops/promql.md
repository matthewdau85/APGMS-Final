# PromQL Alerts & Dashboards

## Availability Burn Rate
- Fast burn (1h):
  `
  sum(rate(http_requests_total{status=~"5.."}[5m]))
    / sum(rate(http_requests_total[5m]))
  > 0.02
  `
- Slow burn (6h): same query with [30m] window and threshold 0.05.

## Latency
- P95 latency (requires histogram instrumentation):
  `
  histogram_quantile(0.95,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
  )
  `

## Auth anomaly
- Detect repeated auth failures via counter derivative:
  `
  increase(security_events_total{event="anomaly.auth"}[5m]) > 0
  `

## Notebooks
- Record queries in Grafana or Prometheus UI and store screenshots in docs/ops/dashboards/.
