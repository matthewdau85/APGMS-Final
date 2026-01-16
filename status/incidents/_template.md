# Incident: {{INCIDENT_ID}}

- **Date opened:** {{OPENED_AT}}
- **Pillar(s) affected:** {{PILLARS}}
- **Opened by script:** {{SCRIPT_NAME}}

## Summary

{{SUMMARY}}

## Timeline

- {{OPENED_AT}} - Incident opened by readiness runner
- TODO - Add events here (alerts, changes, fix deployment)

## Metrics / Dashboards

- TODO - Link to relevant dashboards (Grafana, k6 summary, logs, etc.)

## Root Cause (when known)

- TODO - Fill in after investigation

## Remediation Steps

- TODO - What has been done
- TODO - What still needs to be done

## Verification

- [ ] Reran readiness checks for affected pillar(s)
- [ ] `pnpm readiness:all` returns GREEN
- [ ] Relevant alerts are back within normal ranges
