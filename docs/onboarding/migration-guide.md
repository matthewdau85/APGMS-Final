# Migration Runbook

This document walks through the staged migration approach preferred by enterprise customers. It is based on the pain points captured in the early adopter interviews and references the SDKs and adapters shipped in this change.

## Roles & Responsibilities

| Role | Responsibilities |
| --- | --- |
| Customer Success Manager | Owns cutover schedule, risk log, stakeholder updates |
| Implementation Engineer | Builds integrations, runs dry-run + cutover commands |
| Security Lead | Reviews audit logs, signs off on rollback readiness |
| Finance/Payroll Lead | Validates financial results, approves go-live |

## Stages

1. **Discovery**
   - Inventory current payroll/POS exports, transformations, and posting cadence.
   - Identify edge cases (supplemental pay, manual adjustments, voided checks).
   - Capture KPI baselines (payroll accuracy %, reconciliation time, etc.).
2. **Sandbox Replay**
   - Load historical data via sample adapters (see `examples/payroll-gusto` and `examples/pos-square`).
   - Use the TypeScript or Python SDK to call `POST /v1/migrations/dry-run` for each pay period.
   - Diff the resulting ledger entries with your source of truth.
3. **Pilot Migration**
   - Select 5–10% of locations/employees.
   - Run incremental syncs nightly. Monitor `GET /v1/events` for anomalies.
   - Capture approvals in the migration tracker template (Appendix A).
4. **Full Cutover**
   - Freeze manual edits 24 hours before go-live.
   - Trigger the migration job (CLI: `pnpm apgms migrate start --org <id>`).
   - Broadcast status updates every 30 minutes using the provided Slack template.
5. **Stabilization**
   - Keep sandbox active for smoke tests.
   - Enable automated regression tests via `pnpm --filter @apgms/sdk-typescript test` and `pytest tests/sdk_python`.
   - Review audit logs daily for the first week.

## Rollback Criteria

Rollback is executed via `POST /v1/migrations/<id>/rollback` when any of the following triggers fire:

* Ledger imbalance greater than $100.
* Payroll file fails downstream validation twice in a row.
* Webhook delivery fails for more than 5 minutes (indicates network/firewall issue).

## Communication Templates

* **Executive summary** – 2-paragraph email covering readiness, launch time, and rollback owner.
* **Daily standup** – 15-minute call with implementation + finance leads; review run rate, errors, and support tickets.
* **Post-mortem** – Within 48 hours, document what went well, what to improve, and assign backlog items.

## Metrics Dashboard

| Metric | Target | Source |
| --- | --- | --- |
| Sync success rate | 99.5% | `/v1/events` API | 
| Payroll variance | <$5 per employee | Reconciliation script |
| Cutover duration | <2 hours | Migration tracker |
| Time-to-rollback | <15 minutes | On-call drill |

## Appendix A – Migration Tracker Template

```
Date | Stage | Scope | Owner | Risks | Decision
2024-11-05 | Sandbox Replay | Pay periods Jan–Mar | Alex (Eng) | Need seeded bonuses | Proceed
```

Store the tracker in your PM tool of choice; the CSM will request weekly exports for audit purposes.
