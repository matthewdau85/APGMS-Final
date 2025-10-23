# Chaos Testing Playbook

## Scope
- Simulate database outages, elevated latency, and Redis/KMS failures against the API gateway.
- Validate readiness endpoints, k6 smoke, and alerting respond within defined SLOs.

## Prerequisites
- Local environment or staging cluster with observability stack.
- `pnpm k6:smoke` and compliance scripts available.

## Experiments
1. **Database interruption**
   - Stop Postgres container or revoke network access for 5 minutes.
   - Expected: `/ready` returns 503, anomaly events logged, CI smoke fails.
   - Recovery: restore DB, rerun `pnpm k6:smoke`.
2. **Latency injection**
   - Use `toxiproxy` or `tc` to add 300ms latency on DB transport.
   - Monitor `http_request_duration_seconds` p95; alert should cross 500ms.
   - Remove latency after 10 minutes and confirm metrics recover.
3. **KMS key rotation during load**
   - Run `pnpm security:rotate-keys` (dry run) to simulate new keys, then deploy.
   - Ensure decrypt/export endpoints continue to succeed.

## Reporting
- Document results under `status/incidents/<yyyy-mm-dd>-chaos.md`.
- Attach compliance evidence (`pnpm compliance:evidence --tag chaos-<date>`).
- File tickets for any SLO violations or missing alerts.
