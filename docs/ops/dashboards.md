# Dashboards

## Prometheus/Grafana Panels
- **Request volume**: Chart `sum by (route) (rate(apgms_api_requests_total[5m]))` to spot traffic spikes per Fastify route.
- **Error ratio**: Single-stat on `sum(rate(apgms_api_requests_total{status=~"5.."}[5m])) / sum(rate(apgms_api_requests_total[5m]))`.
- **Readiness failures**: Alert on `sum_over_time((probe_success == 0)[15m])` or scrape gaps. Pair with `/ready` probe in blackbox exporter.
- **Auth anomalies**: Track `sum(rate(apgms_api_requests_total{route="/alerts/:id/resolve",status="401"}[5m]))` to catch repeated MFA denials.

Store exported dashboards in `artifacts/dashboards/` for versioned sharing.
