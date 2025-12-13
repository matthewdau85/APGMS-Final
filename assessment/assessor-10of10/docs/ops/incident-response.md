# Incident response plan

Severity:
- SEV0: confirmed breach or critical availability failure
- SEV1: major degradation or suspected breach
- SEV2: partial outage, elevated error rates
- SEV3: minor issues

Phases:
1) Detect and triage
2) Contain and mitigate
3) Eradicate root cause
4) Recover services
5) Post-incident review (PIR)

Requirements:
- Single incident channel and incident commander role
- Evidence capture (logs, metrics, timeline)
- Regulator notification decision tree
- Customer communications templates

Artifacts:
- scripts/readiness/open-incident.cjs can be used to create an incident stub.
