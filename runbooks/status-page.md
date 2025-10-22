# Status Page Runbook

Use this runbook when the public status page requires manual intervention during an incident or scheduled maintenance.

## 1. Preparation
- Confirm you have OpsGenie and CDN access before starting your on-call shift.
- Join the active incident channel (e.g. `#inc-<date>-<service>`) to mirror updates posted to the status page.
- Bookmark the tooling links listed in [status/README.md](../status/README.md).

## 2. Declaring an Incident
1. Open the OpsGenie incident and click **Update Statuspage**.
2. Select affected components and set the severity:
   - **Minor:** Partial degradation with workarounds.
   - **Major:** Customer-facing downtime or severe latency.
   - **Critical:** Complete outage of a core journey.
3. Publish the first customer update within 15 minutes including:
   - Impact summary.
   - Time of detection.
   - Owner handling mitigation.
4. Post a matching update in the incident Slack channel to keep internal stakeholders aligned.

## 3. Ongoing Communications
- Add timeline updates at least every 30 minutes; include hypothesis, mitigation progress, and next checkpoint.
- If no mitigation progress for 45 minutes, escalate to the secondary on-call rotation and request subject-matter experts.
- Attach graphs or screenshots when they help customers understand the impact.

## 4. Resolution
- When mitigated, update component status to **Operational** and post a resolution summary.
- Trigger the "Send subscriber email" option to notify subscribers of recovery.
- Capture action items for the retrospective and link the document once published (within 7 days for SEV-1/2).

## 5. Maintenance Events
- Schedule maintenance at least 48 hours in advance where possible.
- Include customer impact, maintenance window, and rollback owner in the announcement.
- Post reminders 1 hour before the window starts and confirm completion when systems are back to normal.

## 6. Auditing and Handover
- Export the incident timeline after closure and store it in the incident drive for compliance.
- During shift handover, review open incidents and scheduled maintenance with the incoming on-call engineer.

