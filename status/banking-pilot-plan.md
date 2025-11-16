# Banking Pilot Plan

The new banking adapter service (`services/banking`) exposes metadata for every connector so we can track certification status, sandbox endpoints, and run-rate reliability. This plan documents the first production pilots and the metrics that operations needs to capture before graduating the adapters to GA.

## Pilot Cohorts

| Customer | Connector | Pilot Window | Scope | Observability Hooks |
| --- | --- | --- | --- | --- |
| BetaRetail Group | NAB sandbox | Nov–Dec 2025 | GST capture and reconciliations for two venues | Grafana dashboard `banking.nab.beta` plus evidence artefacts produced by the reconciliation job. |
| Lakes Payroll Co. | CBA sandbox | Dec 2025 | PAYGW designated account funding for three SMEs | Alerts routed via `banking-provider: sandbox_notification_failed` log events and per-run reconciliation artefacts stored in WORM. |
| WestWave Hospitality | Westpac sandbox | Jan 2026 | Combined GST + PAYGW sweep with POS feeds | Synthetic transfer probes running hourly against the westpac connector plus pilot feedback notes tracked in Jira `BKPILOT-` series. |

We only onboard one customer per connector to begin with so that we can compare ledger deltas against bank statements manually during the burn-in period. Each pilot must sign the shared evidence log (see `docs/compliance/designated-accounts.md`).

## Reliability Metrics to Capture

| Connector | Certification Status | Availability Target | Metrics Recorded |
| --- | --- | --- | --- |
| NAB | In progress (DSP + ADI evidence submitted) | 99.9% banking API availability, <0.1% failed credits | `services/banking` metadata exports uptime/sample window, while `providers/banking` logs every credit attempt and sandbox notification outcome. |
| CBA | Audit prep (sandbox cert complete) | 99.5% with 15 min RTO | Capture `sandbox_notification_failed` warnings, reconciliation artefact timestamps, and customer-visible status updates in `status/README.md`. |
| Westpac | Awaiting compliance attestation | 99.0% with weekly reliability review | Monitor credit success rate, reconciliation latency, and any HTTP failure counts; roll-up weekly into the status site for executive review. |

Operations should snapshot these metrics after every pilot run and attach them to the weekly release note so stakeholders can confirm that the connectors meet the minimum reliability envelope before expanding access.
