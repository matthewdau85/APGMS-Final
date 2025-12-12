# Service Level Objectives (SLOs) – APGMS API Gateway

Version: 0.1
Last updated: YYYY-MM-DD
Owner: APGMS Team

## Purpose

SLOs describe reliability and performance targets for APGMS. They enable:
- objective incident severity classification
- clear alert thresholds
- partner expectations and operational governance

These SLOs apply primarily to the API Gateway and its critical paths:
- Health/readiness
- Settlement initiation and lifecycle updates
- Data export endpoints (where present)

## Definitions

- Availability: Percentage of successful requests (non-5xx) over a rolling window.
- Latency: p95 response time (95th percentile).
- Error rate: ratio of 5xx responses to total requests.
- “Normal mode”: service mode = `normal`.
- “Read-only mode”: service mode = `read-only`.
- “Suspended mode”: service mode = `suspended` (intentional 503 behavior).

Note: During `suspended`, 503s are expected. Availability calculations should exclude the maintenance window if suspension is declared as an operational event.

---

## SLO 1: Availability (Gateway)

Target:
- **99.5%** monthly availability for critical endpoints during Normal mode.

Critical endpoints:
- `GET /health`
- `GET /ready`
- `POST /api/settlements/bas/finalise`
- Settlement lifecycle endpoints under `/api/settlements/bas/*` (as applicable)

Measurement:
- Metrics source: HTTP server metrics (OpenTelemetry / Prometheus / equivalent)
- Success criteria: status code != 5xx (excluding declared maintenance/suspension windows)

Alerting:
- Page: availability < 99.0% over 30 minutes
- Ticket: availability < 99.5% over 6 hours

Owner:
- On-call engineer / operator

---

## SLO 2: Latency (p95)

Targets (Normal mode):
- **Read endpoints p95 < 300ms** over 15 minutes
- **Write endpoints p95 < 600ms** over 15 minutes

Classification:
- Read endpoints: GET/HEAD/OPTIONS
- Write endpoints: POST/PUT/PATCH/DELETE

Measurement:
- Metrics source: HTTP duration histogram (OpenTelemetry / Prometheus / equivalent)
- Report p95 by route group

Alerting:
- Page: p95 exceeds target for 15 minutes AND request volume above minimum threshold (to avoid noise)
- Ticket: p95 exceeds target for 60 minutes

Notes:
- Use separate SLOs per region/environment if deployments differ materially.

---

## SLO 3: Error rate (5xx)

Target:
- **5xx error rate < 0.5%** over 30 minutes (Normal mode)

Measurement:
- Metrics source: HTTP status code counters (OpenTelemetry / logs-to-metrics)

Alerting:
- Page: 5xx > 2% over 10 minutes
- Ticket: 5xx > 0.5% over 30 minutes

---

## SLO 4: Correctness guardrails (service mode)

Target:
- When `serviceMode = suspended`, mutating endpoints must return **503** quickly and consistently.
- When `serviceMode = read-only`, mutating endpoints must return **409** and read endpoints must remain functional.

Evidence:
- Unit tests for service-mode behavior
- Manual runbook steps for mode flipping

---

## Operational mapping

### Metrics sources (choose one; document actual implementation)
- Option A: OpenTelemetry SDK -> Collector -> Prometheus/Grafana
- Option B: Cloud provider metrics + logs
- Option C: Log-based metrics (status/latency from structured logs)

### Alert routing
- Paging channel: on-call (P1/P2)
- Ticketing: backlog (P3)

### Readiness scripts
If readiness scripts are used (availability/performance/log-scan), record them here:
- `pnpm readiness:availability`
- `pnpm readiness:availability-and-performance`
- `pnpm readiness:log-scan`
- `pnpm readiness:k6`

---

## Review cadence

- Monthly SLO review: update targets based on observed performance and partner needs
- Post-incident review: assess whether SLOs and alerting were effective
