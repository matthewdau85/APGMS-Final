# Service Level Objectives

## Availability
- **SLO**: 99.5% monthly availability for the API gateway.
- **Metric**: (1 - sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m])))
- **Alert**: Fast burn (>2% error budget burn in 1 hour), slow burn (>5% in 6 hours).

## Latency
- **SLO**: p95 latency = 500ms and p99 = 1s on /bank-lines, /users.
- **Metric**: Prometheus histogram http_request_duration_seconds_bucket (to be instrumented in Phase 3) or fallback log-based percentiles.
- **Alert**: Trigger when p95 > 500ms for 10 minutes.

## Error Budget
- 0.5% monthly downtime = ~3.65 hours; track remaining budget in Grafana dashboard.

## Observability Links
- Prometheus queries defined in ops/slo/promql.md (to be created).
- Grafana dashboard API Gateway SLO displays availability, latency, anomaly counts.

## Review Cadence
- Monthly SLO review; escalate breaches to Platform Ops + Security.

## Alert Implementation
- See `docs/ops/promql.md` for PromQL queries. Configure Alertmanager to route fast/slow burn alerts to on-call distribution.
- Mirror anomaly alerts (`security_events_total{event="anomaly.auth"}`) to Security team.
