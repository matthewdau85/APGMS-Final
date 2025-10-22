# On-call Rotation Handover

Use this runbook when starting or ending an operations or security on-call shift.

## Before your shift

1. Review the last 7 days of incidents in PagerDuty and confirm outstanding actions.
2. Skim the `#ops-announcements` and `#security-alerts` channels for context that might impact your shift.
3. Verify access to required tools: PagerDuty, Grafana, Kubernetes dashboard, Splunk, and the status site CMS.
4. Generate a fresh admin token (`make rotate-admin-token`) if your shift will include privileged support. Update the secret in
   1Password and confirm the API Gateway picked it up via `/ready`. 【services/api-gateway/src/app.ts#L71-L152】

## During your shift

1. Keep PagerDuty and Slack reachable; enable "do not disturb" exceptions for incident roles.
2. Acknowledge alerts within 5 minutes and follow the Incident Response Playbook for triage.
3. Record significant investigations in the on-call journal (Notion) including timestamps, hypotheses, and outcomes.
4. If you need help, escalate to the secondary on-call, then the engineering manager, then the CTO.
5. For privacy-impacting events, notify the security lead and follow the Notifiable Data Breach runbook.

## Handover checklist

1. Post a summary in `#oncall-handover` including incidents worked, outstanding follow-ups, and relevant dashboards.
2. Transfer open PagerDuty incidents to the incoming responder.
3. Confirm all temporary credentials created during the shift are revoked or rotated.
4. Ensure the status site reflects the current state (no stale incidents).
5. Share any lessons learned or improvements required for alerts and runbooks.

## Escalation paths

* Secondary on-call: rotate weekly; see PagerDuty schedule.
* Engineering manager: <eng-manager@birchal.com> (business hours) / phone in PagerDuty notes (after hours).
* CTO: <cto@birchal.com>.
* Privacy officer (for DPIA-impacting events): <privacy@birchal.com>.

## References

* Incident Response Playbook. 【runbooks/incident-response.md#L1-L60】
* OWASP ASVS control coverage. 【docs/security/ASVS-mapping.md#L1-L40】
* DPIA (to evaluate whether new features require re-assessment). 【docs/privacy/dpia.md#L1-L87】
