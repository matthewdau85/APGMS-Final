# Procurement Questionnaire Pack

## Audience
Procurement and security review teams evaluating APGMS for inclusion on their platforms. Documents respond to open questions about controls, resilience, and compliance readiness.

## Highlights
- **Assurance posture**: Pragmatic roadmap from prototype controls to SOC2-Ready automation (see docs/runbooks/ato-rules-maintenance.md for context).
- **Availability**: Health/ready/metrics endpoints exist, readiness gate script auto-starts the API gateway, and readiness reports surface when DB is reachable.
- **Incident readiness**: Severity model defined (Sev1-3), on-call outside business hours, and incident comms reference explicit integrity triggers.
- **Procurement target**: Non-contractual SLO target 99.9% monthly with patch SLAs (critical 7d, high 30d, medium 90d).

## Next steps for reviewers
Collect evidentiary artifacts (logs, readiness results), verify validate:ato runs clean, and use the safety checklist in docs/runbooks/ato-rules-maintenance.md before endorsing changes.
