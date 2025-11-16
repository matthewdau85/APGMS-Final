# Dashboards

## Prometheus/Grafana Panels
- **Request volume**: Chart `sum by (route) (rate(apgms_api_requests_total[5m]))` to spot traffic spikes per Fastify route.
- **Error ratio**: Single-stat on `sum(rate(apgms_api_requests_total{status=~"5.."}[5m])) / sum(rate(apgms_api_requests_total[5m]))`.
- **Readiness failures**: Alert on `sum_over_time((probe_success == 0)[15m])` or scrape gaps. Pair with `/ready` probe in blackbox exporter.
- **Auth anomalies**: Track `sum(rate(apgms_api_requests_total{route="/alerts/:id/resolve",status="401"}[5m]))` to catch repeated MFA denials.

Store exported dashboards in `artifacts/dashboards/` for versioned sharing.

## Model monitoring
- **Forecast accuracy board**: Point Grafana/Looker (or a static status page) at `artifacts/analytics/model-monitoring-dashboard.json` to surface EWMA vs. regression predictions, coverage bands, and the watchlist emitted by `services/analytics`.
- **Confidence interval coverage**: Build a table that highlights organisations where the actual PAYGW/GST values fall outside `forecast.intervals` from `shared/src/ledger/predictive.ts`. This data now flows through `/compliance/status` and `/compliance/tier-check`, so the same panel can double as an alert readiness view.
- **Schedule drift**: Plot `alertSchedule.nextRunAt - now()` from `/compliance/status` so ops can see if the tier check scheduler is falling behind the configured cadence.
