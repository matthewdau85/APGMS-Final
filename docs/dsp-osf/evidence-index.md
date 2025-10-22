# DSP Operational Security Framework Evidence Index

This index maps APGMS evidence artefacts to the Digital Service Provider Operational
Security Framework (DSP OSF) control families. Owners are responsible for keeping the
referenced documents current in the compliance evidence vault.

| Control family | Evidence artefact | Location | Update cadence | Control owner | Status |
| --- | --- | --- | --- | --- | --- |
| Governance & risk | Risk register and quarterly review deck | `docs/risk/register.md` & Confluence `Risk-QBR` space | Quarterly | Head of Risk | ✅ Current (reviewed 2024-10-28) |
| Access management | AccessHub grant logs, TFN access approvals | GRC vault `/evidence/access/` | Monthly | Security Engineering | ✅ Refreshed via automation 2024-10-30 |
| Data protection | TFN SOP (this repo) and Key Management Procedure | `docs/security/TFN-SOP.md`, `artifacts/kms/rotation.md` | Annual or after key rotation | Compliance | ✅ Current (rotation logged 2024-09-30) |
| Incident response | NDB runbook execution checklist | `runbooks/ndb.md` | After each incident | Incident Commander | ✅ No incidents since last review |
| Change management | CI/CD deployment approvals, RFC summary | GitHub `deployments/` reports | Per release | Platform Engineering | ✅ Linked for releases 2024-43 |
| Business continuity | DR test report and RTO/RPO attestation | GRC vault `/evidence/bcp/2024/` | Annual | Operations | ✅ Tabletop actions closed 2024-10-26 (Ops-271) |
| Privacy | Privacy policy diff log, consent banner audit | `docs/legal/Privacy-Policy-draft.md`, `artifacts/privacy/consent-review.md` | Semi-annual | Privacy Officer | ✅ Current (2024-10-10) |
| Accessibility | WCAG audit report, guild minutes | `docs/accessibility/report.md`, Confluence `Accessibility-QBR` | Quarterly | Product Accessibility Lead | ✅ Minutes uploaded 2024-10-29 |
| Vendor management | Third-party security assessments, SIG questionnaire responses | GRC vault `/evidence/vendors/2024/` | Continuous monitoring | Vendor Risk Manager | ✅ DataCleanse remediation signed 2024-10-29 |
| Training & awareness | LMS completion exports, attendance rosters | Compliance shared drive `/training/exports/` | Monthly | PeopleOps | ✅ October refresher export auto-synced 2024-10-30 |
| Monitoring & logging | CloudTrail immutable logs, SIEM alert reports | Security data lake `/logging/` | Monthly | Security Engineering | ✅ Current (ingested 2024-10-28) |
| Data integrity | ETL validation reports, checksum attestations | DataOps bucket `/integrity/` | Quarterly | Data Platform Lead | ✅ Current (2024-Q3 attestation uploaded) |
| Predictive controls | Compliance drift forecasts, anomaly detection output | Snowflake share `compliance.analytics` | Weekly | Risk Analytics Lead | ✅ Current (forecast run 2024-10-30) |
| Transparency & reporting | Maturity model assessment, executive scorecard PDF | `docs/compliance/maturity-model.md`, `artifacts/compliance/` | Monthly | Compliance Ops Lead | ✅ Current (published 2024-11-01) |

## Evidence maintenance workflow

1. **Control owners** upload artefacts to the encrypted GRC vault and link them here, including
   the last review date and status.
2. **Compliance operations** performs a monthly sweep to verify artefact freshness and send
   reminders for anything older than the defined cadence. Age breaches are tracked in Jira
   project `COMP` and surfaced on the compliance scorecard.
3. **Audit preparation** exports this index as part of the regulator submission packet and ensures
   referenced files are signed by the appropriate executive.
4. **Steering committee** reviews any ⚠️ entries during the monthly meeting and assigns owners
   to close them within the next cycle.

## Evidence automation notes

- Evidence links include retention metadata so auditors can verify when files will expire.
- The compliance worker posts a digest in `#compliance-help` summarising newly uploaded artefacts
  and any links that failed validation.
- Vault folders use object-lock to prevent deletion prior to the defined retention period and
  append immutability receipts to the Snowflake warehouse.
- Owners receive a ServiceNow reminder seven days before the cadence deadline with links to
  relevant SOPs or runbooks, plus predictive alerts if telemetry signals likely drift.
- Customer assurance portal subscribers can self-serve the latest attestations with download logs
  stored alongside evidence entries.

## Change log

| Date | Change | Owner |
| --- | --- | --- |
| 2024-10-15 | Initial index covering DSP OSF controls | Compliance Ops |
| 2024-10-25 | Added vendor, training, monitoring, and integrity evidence plus automation notes | Compliance Ops |
| 2024-11-01 | Closed outstanding ⚠️ entries, added predictive controls stream, and expanded automation notes | Compliance Ops |

