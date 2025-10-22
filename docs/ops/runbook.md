# Operations on-call runbook

This runbook guides the operations engineer on-call through the first 60 minutes of a
customer-impacting incident affecting the APGMS platform.

## 1. Acknowledge and assess

1. Accept the PagerDuty alert and announce ownership in `#incidents`.
2. Review dashboards for API latency, error rate, worker queue backlog, and accessibility SLIs.
3. Determine blast radius: affected routes, percentage of customers, compliance impact, and
   whether predictive compliance drift scores have spiked.

## 2. Stabilise the platform

1. If latency is spiking, enable the read-only mode feature flag to protect the database.
2. For worker backlog, trigger the `scale-workers` runbook to double concurrency for 30 minutes
   and verify that evidence snapshot jobs resume within SLA.
3. Capture relevant logs using `kubectl logs --since=15m` and store in the incident drive, then
   attach to the ServiceNow incident for compliance traceability.
4. Confirm auto-remediation scripts for infrastructure drift have executed; if not, trigger
   `terraform-plan-rollback` workflow.

## 3. Communicate

1. Post a customer-facing update to the status page within 15 minutes, including accessibility
   status if relevant.
2. Notify Compliance if TFN, regulator, or evidence automation workflows are affected and tag the
   compliance steering alias.
3. Schedule the next update cadence (typically every 30 minutes) and delegate comms if needed;
   ensure updates sync to the customer assurance portal.

## 4. Escalate

- Application errors → Page the Platform Engineering secondary.
- Database anomalies → Engage the DBA on-call.
- Compliance-affecting incidents → Loop in the Privacy Officer immediately.
- Accessibility regression impacting SLAs → Notify the Product Accessibility Guild facilitator.

## 5. Hand-off and documentation

1. Ensure all actions, timestamps, and owners are recorded in the incident timeline.
2. Create Jira incident ticket with labels `incident`, `customer-impacting`, severity, and any
   relevant compliance tags (`tfn`, `a11y`, `evidence`).
3. Hand over to the next shift with a summary of current status and outstanding tasks, plus the
   latest compliance scorecard snapshot if metrics were impacted.
4. Trigger the automated post-incident review template in Confluence within 24 hours.

## References

- `runbooks/ndb.md` for notifiable data breach requirements.
- `docs/security/TFN-SOP.md` for handling sensitive identifiers.
- `docs/accessibility/report.md` if accessibility SLAs are at risk.
- `docs/compliance/scorecard.md` for current compliance targets and metrics.

