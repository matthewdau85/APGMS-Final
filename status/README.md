# Status Site Operations

The status site communicates production availability, scheduled maintenance, and incident timelines. This guide covers day-to-day upkeep and emergency workflows.

## Platform Overview
- **Source:** `status/` contains the Next.js project that renders the public page and consumes uptime webhooks.
- **Hosting:** Deployed via the `status` service pipeline; builds publish static assets to the CDN edge.
- **Data Sources:**
  - Synthetic checks from `worker/uptime` drive the "API" and "Console" components.
  - Manual incidents are created via the on-call form in OpsGenie, which pushes updates to the status API.

## Daily Health Checklist
- Review overnight incidents before 09:00 local time and confirm they are in the correct resolved state.
- Validate the subscription webhook by checking the `status-log` dashboard for fresh pings (within the last 15 minutes).
- Ensure scheduled maintenance events have clear start/end times and associated owners.

## Incident Workflow
1. **Triage:** Follow the relevant service runbook to determine impact and owner.
2. **Declare:** Create or update the active incident on the status page with:
   - Impacted components and customer-facing symptoms.
   - Timestamped updates every 30 minutes until mitigation.
   - Links to Slack incident channels for internal coordination.
3. **Mitigate:** Track mitigation steps and ETA in the incident timeline. Escalate if no mitigation progress is achieved within the SLA below.
4. **Recover:** When service is stable, post a resolution summary that includes root cause, mitigations, and any follow-up actions.
5. **Postmortem:** Link the retrospective document once completed so subscribers receive the final summary.

## Escalation Paths
- **Primary On-Call:** OpsGenie rotation `platform-oncall`.
- **Secondary:** Page the `infrastructure` rotation if the primary does not acknowledge within 15 minutes.
- **Executive Visibility:** Notify the COO and Head of Support for incidents breaching customer SLAs.
- **Regulatory:** If customer data exposure is suspected, immediately follow the [NDB runbook](../runbooks/ndb.md) in parallel.

## Communication SLAs
- **Initial customer update:** within 15 minutes of declaring the incident.
- **Subsequent updates:** at least every 30 minutes while the incident is ongoing.
- **Customer notification of resolution:** within 10 minutes of mitigation.
- **Retrospective publication:** within 7 calendar days for SEV-1 and SEV-2 incidents.

## Tooling Quick Links
- OpsGenie incident dashboard: <https://opsgenie.example.com/incidents>
- Grafana synthetic check dashboard: <https://grafana.example.com/d/status>
- Status site repo (`status/`): <https://git.example.com/apgms/status>

