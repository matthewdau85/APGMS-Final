# Bank partner enablement packet

This packet summarises the information we provide to new banking partners during onboarding.
It is designed to accelerate diligence while demonstrating our compliance posture.

## Overview deck

- Company mission, leadership bios, and key metrics
- Portfolio monitoring workflows, compliance automation, and integration points
- Customer success stories highlighting capital efficiency gains and evidence automation ROI

## Due diligence artefacts

| Document | Purpose | Owner | Location |
| --- | --- | --- | --- |
| SOC 2 Type II report | Independent assurance of security controls | Security | Shared securely via SecureShare link |
| TFN SOP | Demonstrates tax identifier handling controls | Compliance | `docs/security/TFN-SOP.md` |
| DSP OSF evidence index | Maps controls to regulatory requirements | Compliance Ops | `docs/dsp-osf/evidence-index.md` |
| Compliance scorecard | Provides near-real-time control performance | Compliance Ops | `docs/compliance/scorecard.md` |
| Privacy APP 12/13 process | Shows individual rights handling | Privacy | `docs/privacy.md` |
| Accessibility statement | Confirms inclusive product design | Product | `docs/accessibility-statement.md` |
| Accessibility audit report | Demonstrates WCAG conformance and roadmap | Product Accessibility Guild | `docs/accessibility/report.md` |

## Technical integration checklist

1. Exchange API credentials via the partner SFTP channel and register the integration in the
   partner assurance portal.
2. Configure webhook endpoints for bank line updates (`/webhooks/bank-line`).
3. Validate payloads using the schema published in the developer portal and confirm automated
   contract testing is green.
4. Schedule quarterly alignment calls with the APGMS integrations team, including compliance and
   accessibility liaisons.
5. Subscribe to the Snowflake data share for compliance telemetry (optional but recommended).

## Communication cadence

- Weekly status email summarising onboarding progress and integration telemetry
- Monthly risk and compliance review with evidence of scorecard performance
- Quarterly roadmap session focused on new features, data sharing, and joint accessibility goals

