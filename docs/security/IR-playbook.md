# Incident Response Playbook
_Last exercised: 15 Oct 2025_

## Severity Matrix
| Severity | Example | Response Target |
| --- | --- | --- |
| Sev 1 | Confirmed compromise of TFN data, widespread outage | Notify ATO & OAIC within 24h, exec bridge within 15 min |
| Sev 2 | Contained intrusion, service degradation | Incident commander paged within 15 min |
| Sev 3 | Suspicious activity, monitoring anomaly | Security duty officer reviews within 2 h |

## Roles
- **Incident Commander (IC)**: Coordinates response, declares severity, owns comms log.
- **Tech Lead**: Investigates root cause, executes mitigations, documents fixes.
- **Comms Lead**: Handles stakeholder updates (customers, regulators, internal execs).
- **Scribe**: Maintains incident timeline in PagerDuty.

## Workflow
1. **Detect**: Alerts from SIEM, uptime probes, or customer reports trigger PagerDuty service `APGMS Security`.
2. **Triage**: IC validates severity, ensures forensic capture (CloudTrail, host snapshots), and declares incident in Jira (`SECINC-*`).
3. **Contain**: Disable compromised credentials, isolate workloads, block malicious IPs via AWS WAF/Security Groups.
4. **Eradicate**: Apply patches, rotate secrets, restore from clean backups if necessary.
5. **Recover**: Monitor system stability for 24h, re-enable affected services gradually.
6. **Notify**: Regulatory notifications follow OAIC + ATO DSP guidelines using templates stored in `docs/legal/notifications.md`.
7. **Review**: Conduct post-incident review within 5 business days, capturing action items in Confluence + Git issues.

## Tooling
- PagerDuty for paging/escalations.
- Slack channel `#incident-response` (auto-created per incident).
- AWS Security Hub + Detective for investigations.
- `tools/ir-timeline.ts` script to export logs.

## Testing
- Tabletop exercises quarterly; latest scenario "TFN disclosure via misconfigured log" executed 15 Oct 2025.
- Chaos security drills rotate through credential compromise, data exfiltration, and ransomware containment scenarios.
