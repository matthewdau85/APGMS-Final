# DSP OSF evidence index

This index maps key DSP OSF controls to the evidence artifacts auditors expect, where those artifacts live, and how often each control is validated.

| Control | Evidence artifacts | Storage URI | Validation frequency | Runbook / dashboard links |
| --- | --- | --- | --- | --- |
| Designated account reconciliation | Nightly transfer snapshot JSON (`artifacts/compliance/designated-transfer/*.json`), reconciliation worker logs, and tier state exports (`artifacts/compliance/tier-state/<org>.json`). | `artifacts/compliance/` (Git-backed) and the corresponding bucket/object store configured for compliance exports. | Nightly job plus on-demand reruns before BAS lodgment. | [Compliance monitoring runbook](../runbooks/compliance-monitoring.md); surface shortfall/tier cards in the [compliance dashboard](../ops/dashboards.md). |
| Admin data export/delete traceability | Security/audit log pairs showing sanitized admin actions (`security_event` + `AuditLog` chain) with correlation IDs, stored alongside export/delete evidence bundles. | `artifacts/compliance/admin-actions/` and centralized log archive. | Quarterly control review and after every privileged admin action. | [Admin controls runbook](../runbooks/admin-controls.md); correlate with auth anomaly panels in [operational dashboards](../ops/dashboards.md). |
| API availability & SLOs | Prometheus scrape archives, Grafana panel exports, and readiness probe histories demonstrating uptime/error budgets. | `artifacts/dashboards/` for exported panels; scrape history in monitoring backend. | 24x7 alerting with weekly SLO review. | [API gateway operations runbook](../ops/runbook.md); Grafana SLO/availability panels in [dashboards](../ops/dashboards.md). |
| Incident response & NDB | Incident timelines, comms templates, OAIC submissions, and forensic snapshots tied to incident IDs. | `status/incidents/` for timelines; incident bucket for large artifacts. | After every incident declaration; quarterly incident drill. | [Notifiable Data Breach runbook](../../runbooks/ndb.md); link incident entries from `status/README.md` to relevant dashboards. |

## Review process
- **Who reviews**: Compliance lead and platform ops rotate as primary reviewers, with security engineering as an approver for controls that touch PII/TFN data.
- **Cadence**: Quarterly control review covering validation frequencies above, plus ad hoc reviews after any material incident or regulator request.
- **Recording results**: Log findings and remediation tasks in `status/README.md` and append control-specific notes to the corresponding artifact directories (e.g., `artifacts/compliance/` subfolders) so auditors can trace evidence to review outcomes.
