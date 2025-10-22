# Status site

This directory houses the tooling and content used for public incident communications. The playbook below explains how to coordinate updates when a production issue occurs.

## Incident playbook

1. **Triage (0-5 minutes)**
   - On-call engineer confirms the impact and opens an incident thread in `#inc-status`.
   - Assign roles: incident commander (IC), communications lead (CL), and operations lead (OL).
2. **Assess (5-15 minutes)**
   - IC captures scope, customer impact, and mitigation steps in the shared timeline doc.
   - OL validates monitoring dashboards and collects supporting metrics.
   - CL drafts the initial status page entry using the template in `artifacts/status-template.md`.
3. **Communicate (within 15 minutes of declaration)**
   - Publish the first public update (see posting workflow below).
   - Update internal stakeholders in `#eng-leads` and create a Jira incident ticket.
4. **Stabilise**
   - OL drives remediation while IC ensures updates are posted at least every 30 minutes.
   - CL records customer comms questions and escalates blockers to the IC.
5. **Resolve**
   - When service is restored, IC confirms with OL and CL before publishing the recovery update.
   - Schedule the post-incident review within 48 hours and link artifacts in the Jira ticket.

Escalations that involve potential data exposure must additionally follow the [Notifiable Data Breach runbook](../runbooks/ndb.md).

## Status page posting workflow

- **Who posts?** The communications lead (CL) is the only person authorised to publish updates. Backup is the on-call product manager if the CL is unavailable.
- **When to post?**
  - Initial update within 15 minutes of incident declaration.
  - Follow-up updates every 30 minutes while impact continues.
  - Resolution update within 15 minutes of confirming recovery.
- **How to post?**
  1. CL runs `pnpm --filter status deploy` from the repository root to open the publisher prompt.
  2. Enter the prepared message, ensuring it covers impact, scope, mitigation, and next update time.
  3. Verify the rendered preview locally (`pnpm --filter status preview`) before confirming publish.
  4. After publishing, drop the permalink in `#inc-status` and update the incident ticket.
- **Change control**
  - Emergency updates do not require CAB approval but must be retrospectively logged in the change register.
  - Post-incident, archive the final content in the incident knowledge base for auditing.

_Last reviewed: {{< today >}}_
