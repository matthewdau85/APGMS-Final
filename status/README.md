# Status Site Operations Guide

The status site communicates service health, planned maintenance, and incident updates to customers. This guide captures
publishing procedures, service-level commitments, and escalation contacts.

## Platform overview

* URL: https://status.birchal.com (CloudFront + S3 static site).
* Access: Managed via Okta group `status-editors`. Production deploys use the `status-site` GitHub Action.
* Auth: Editors authenticate with SSO; incident updates are signed before publishing.

## Incident update procedure

1. Log in to the status CMS and select the impacted component(s).
2. Post the initial incident within 15 minutes of declaring SEV1/SEV2 (30 minutes for SEV3). Include:
   * Summary of impact (systems, geographies, % of users).
   * Current mitigation steps.
   * Timestamp of next update.
3. Update the incident at least every 30 minutes (SEV1/SEV2) or hourly (SEV3) until resolved.
4. When resolved, post a closure note that includes root-cause highlights and follow-up actions.
5. After resolution, attach the public-facing post-mortem link within 5 business days.

## Maintenance windows

* Planned maintenance must be scheduled at least 5 business days in advance.
* Publish maintenance notices 48 hours before the window begins.
* Include customer impact, duration, rollback plan, and contact details.

## Service-level commitments

| Service | SLA | Notes |
| --- | --- | --- |
| API Gateway | 99.9% monthly availability | Monitored via `/ready`; downtime > 5 min triggers SEV2. |
| Worker ingestion | 99.5% monthly availability | Incidents > 30 min escalate to SEV2. |
| Status site | 99.95% uptime | Hosted on S3/CloudFront; failures trigger manual fallback via GitHub Pages. |

Target response times for customer updates:

* SEV1: initial post ≤ 15 min, updates every 30 min.
* SEV2: initial post ≤ 30 min, updates every 45 min.
* SEV3: initial post ≤ 60 min, updates every 60 min.

## Escalation contacts

1. Primary comms lead: Head of Customer Success (`comms@birchal.com`).
2. Secondary: Product Marketing Manager (`marketing@birchal.com`).
3. Executive sponsor for external statements: COO (`coo@birchal.com`).
4. Legal/compliance review: privacy officer (`privacy@birchal.com`).
5. After-hours phone contacts are stored in PagerDuty notes under "Status Site".

Escalate via Slack `#status-site` and follow up with a PagerDuty manual trigger if no response within 10 minutes for SEV1/SEV2.

## Integrations

* The status site webhooks notify Zendesk and Intercom for proactive support tickets.
* RSS feed is consumed by enterprise customers; avoid breaking changes to incident payloads.

## Related documentation

* Incident Response Playbook. 【runbooks/incident-response.md#L1-L60】
* On-call Rotation Handover. 【runbooks/oncall-rotation.md#L1-L64】
* DPIA reference for privacy-sensitive communications. 【docs/privacy/dpia.md#L1-L87】
