# PromQL Alerts & Dashboards

## Availability Burn Rate
- Fast burn (1h):
  `
  sum(rate(apgms_api_requests_total{status=~"5.."}[5m]))
    / sum(rate(apgms_api_requests_total[5m]))
  > 0.02
  `
- Slow burn (6h): same query with [30m] window and threshold 0.05.

## Latency
- P95 latency (requires histogram instrumentation – TODO):
  `
  histogram_quantile(
    0.95,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
  ) // placeholder until Fastify histogram is wired
  `

## Auth anomaly
- Detect repeated auth failures via counter derivative:
  `
  sum(rate(apgms_api_requests_total{route="/alerts/:id/resolve",status="401"}[5m])) > 0
  `

## Notebooks
- Record queries in Grafana or Prometheus UI and store screenshots in docs/ops/dashboards/.
