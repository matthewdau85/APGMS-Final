# Alerting Guide

## Alertmanager Routing
- Fast burn alert (vailability_fast_burn) pages Platform Ops via PagerDuty.
- Slow burn alert (vailability_slow_burn) notifies Slack channel #ops.
- security_events_total{event="anomaly.auth"} > 0 for 5m sends alert to Security Engineering.

## Testing Alerts
1. Trigger readiness failure by pointing DATABASE_URL to an invalid host; confirm eadiness.fail metric increments and Alertmanager fires.
2. Run promtool test rules with ops/promql.rules.yml (to be added) before deploying new rules.

## Runbooks
- Follow API Gateway Operations Runbook for resolution steps.
- Document alert IDs, timestamps, and remediation in status/README.md.
