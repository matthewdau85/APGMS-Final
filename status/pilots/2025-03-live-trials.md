# March 2025 Live Pilot Report

## Overview
- **Pilot window**: 3–24 March 2025
- **Customers**: Harbour Payroll (mid-market payroll outsourcer) and Westfield Markets (multi-site retail franchise).
- **Objectives**: Validate PAYGW/GST ingestion in production-like flows, stress the reconciliation worker against real bank settlement files, and collect usability feedback before GA.

## Usage & Volume Summary
| Metric | Harbour Payroll | Westfield Markets |
| --- | --- | --- |
| Payroll files processed | 18 fortnightly batches | 6 weekly batches |
| GST/point-of-sale uploads | 12 | 28 |
| Average ingest latency | 2.3 s (p95 3.1 s) | 2.6 s (p95 3.5 s) |
| Compliance job throughput | 4.1k ledger rows/night | 9.8k ledger rows/night |
| Dashboard sessions | 47 unique staff | 63 unique staff |

## Availability & Downtime
- **Measured availability**: 99.93% over the pilot window (0.5 h planned maintenance, 0.2 h unplanned Fastify recycle).
- `/ready` never exceeded the 60 s recovery SLO; HAProxy drained instances successfully during both restarts.
- Redis failover to the secondary node was triggered once (13 March 18:04 AEDT); no customer-visible errors thanks to idempotent payroll ingestion retries.

## Issues & Corrective Actions
1. **Duplicate BAS alert at Harbour Payroll**
   - Cause: long-running reconciliation job overlapped with an ad-hoc ingest and re-raised a resolved alert.
   - Action: added job-lock guards plus dashboard copy clarifying alert states (deployed 16 March).
2. **POS discrepancy widget stale data** at Westfield Markets
   - Cause: metering service cached queue depth for 10 minutes, conflicting with near-real-time requirement.
   - Action: reduced cache TTL to 60 seconds, added Prometheus alert `pos_discrepancy_stale_data`.
3. **Bank settlement mismatch**
   - Cause: trailing whitespace in ABA settlement file.
   - Action: normalization step added to reconciliation worker (commit `8d3b1ce`). Verified via regression replay 22 March.

## Feedback Highlights
- Staff appreciated the unified PAYGW/GST tiles but requested inline tooltips summarising forecast tiers.
- Operational teams want proactive emails when queue length exceeds 5k; ticket #OPS-142 tracks the webhook rollout.

## Improvements Deployed Post-Pilot
- Enabled multi-AZ failover templates (see `docs/ops/ha-dr-plan.md`).
- Added discrepancy alerts and BAS deadline tiles to the React dashboard (`webapp/src/modules/obligations/*`).
- Documented the revised runbooks and training checklist in `docs/runbooks/enablement.md`.

## Evidence Links
- **Metrics exports**: `artifacts/dashboards/2025-03-pilot-grafana.json`
- **Reconciliation logs**: `artifacts/compliance/pilots/2025-03/`
- **Customer sign-off forms**: `artifacts/compliance/pilots/2025-03/signoff.pdf`
