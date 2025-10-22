# Incident Response Playbook

This playbook guides responders through a production-impacting incident from the moment an alert fires until resolution and
follow-up. Use it for security, availability, and privacy events that affect customer-facing systems.

## 1. Detection and triage

1. Ack the page in PagerDuty within 5 minutes.
2. Review the triggering alert in Grafana/Elastic to understand scope (service, severity, correlated alerts).
3. Decide whether to declare an incident. If severity >= SEV2 or customer data is at risk, page the incident commander (IC) from
the rotation schedule.

## 2. Containment

1. Assign roles in `#inc-<date>`: IC, comms lead, operations lead, scribe.
2. Capture current state: screenshots, logs (use `kubectl logs --tail=500 --since=10m`), and metrics snapshots.
3. Apply tactical mitigations (scale down, feature flag, revoke credentials) while keeping the IC informed.
4. If PII may be impacted, transition to the Notifiable Data Breach runbook after consulting the security lead.

## 3. Eradication and recovery

1. Identify root cause hypotheses and create Jira tasks for each remediation experiment.
2. Implement the least risky fix first (rollback, config change, failover).
3. Validate the fix via automated tests (`pnpm test --filter service:api-gateway`) and targeted smoke checks.
4. Monitor metrics for 30 minutes to confirm stability before declaring resolved.

## 4. Communication

1. Update the public status site every 30 minutes for SEV1/SEV2 incidents; follow the Status Site SOP for templates.
2. Post internal updates in `#inc-<date>` on the same cadence, tagging impacted stakeholder teams.
3. Capture customer-impact assessments and decisions in the running timeline document.

## 5. Post-incident actions

1. Schedule a retrospective within 7 days; invite engineering, product, support, and security.
2. File follow-up actions in Jira with explicit owners and due dates; link them to the incident record.
3. Update runbooks, dashboards, or alerts that failed or produced noise.
4. Close the incident in PagerDuty and archive the Slack channel once retro actions are in progress.

## Reference material

* Notifiable Data Breach runbook for regulator escalations. 【runbooks/ndb.md#L1-L81】
* Status site SOP for communication templates. 【status/README.md#L1-L120】
* ASVS control inventory for defensive design context. 【docs/security/ASVS-mapping.md#L1-L40】
