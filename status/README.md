# Status Site Operations Guide

## Incident workflow
1. **Detection:** PagerDuty or automated health checks trigger an alert when `/health` endpoints fail or latency breaches thresholds. On-call acknowledges within 5 minutes.
2. **Triage:** Validate impact by querying the API gateway health endpoint and recent logs. Identify affected regions, scope, and whether TFN/PII data is implicated.
3. **Customer update:** Publish an initial notice on the status site within 15 minutes using the templates below. Include start time, symptoms, and current mitigation.
4. **Resolution:** Coordinate service rollback or remediation, verify recovery through synthetic monitors, and document the fix.
5. **Retrospective:** Within 48 hours capture root cause, timeline, customer impact, and remediation tasks in the incident tracker.

## Communication templates
- **Initial update:**
  > _We are investigating an incident affecting **<service>**. Customers may experience **<symptom>** since **<start time>**. Our engineers are working on mitigation and will provide the next update by **<next update time>**._
- **Mitigation in progress:**
  > _Mitigation is underway for the **<service>** incident. We have identified **<root cause>** and expect recovery by **<eta>**. Monitoring continues._
- **Resolved:**
  > _The **<service>** incident is resolved as of **<resolution time>**. Root cause: **<summary>**. Impacted customers should now see normal behaviour. Please contact support if issues persist._

## Uptime targets
- **API gateway:** 99.9% monthly availability, measured via `/health` probes every 60 seconds.
- **Customer web app:** 99.5% monthly availability, monitored by synthetic journeys covering the home and bank lines pages.
- **Status site:** 99.99% availability; outages longer than 5 minutes trigger immediate executive notification.
