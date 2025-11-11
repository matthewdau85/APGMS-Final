# DSP Readiness Matrix

| DSP Requirement | Owner | Control(s) | Evidence Source |
|-----------------|-------|------------|-----------------|
| Governance & Risk Management | CISO | Enterprise risk register, quarterly risk reviews | `docs/risk/register.xlsx`, Risk Committee minutes |
| Asset Management | IT Operations | CMDB automation, asset tagging policy | ServiceNow CMDB exports, asset tagging audit reports |
| Access Control | Identity & Access Mgmt Lead | Okta MFA enforcement, least-privilege RBAC | Okta policy exports, quarterly access review sign-offs |
| Data Security | Data Protection Officer | Encryption standards, anonymisation controls | `SECURITY.md`, anonymisation validation reports |
| Logging & Monitoring | Security Engineering | Centralised SIEM, tamper-evident log archive | `infra/log-archive` integrity reports, SIEM dashboards |
| Incident Response | Incident Commander | IR playbooks, 24/7 on-call | `runbooks/ir/incident-response.md`, PagerDuty reports |
| Business Continuity | Resilience Program Manager | DR testing, RTO/RPO tracking | DR test reports, continuity exercise minutes |
| Supplier Management | Procurement Lead | Third-party risk assessments, contract clauses | Vendor risk assessment tracker, contract repository |
| Secure Development | Head of Engineering | Secure SDLC, automated dependency scanning | `docs/security/secure-sdlc.md`, CI scan logs |
| Change Management | Platform Operations | CAB approval workflow, deployment gates | Change management tool exports, CAB minutes |
| Privacy & Compliance | Compliance Officer | Data retention register, privacy impact assessments | `runbooks/data-governance.md`, PIA repository |
| Training & Awareness | People Operations | Mandatory security & privacy training | LMS completion reports |
| Physical Security | Workplace Services | Badge access control, CCTV monitoring | Badge access logs, physical security audits |
| Vulnerability Management | Security Engineering | Weekly scanning, patch SLAs | Vulnerability scan reports, remediation tracking |
| Penetration Testing | Security Engineering | Semi-annual third-party testing | Pen-test reports, remediation evidence |
| Configuration Management | SRE Lead | Infrastructure as Code baselines, drift detection | Git repos (`infra/`), drift detection alerts |
| Forensics & eDiscovery | Security Operations | Forensic logging standards, evidence preservation | `SECURITY.md`, forensic toolkit runbooks |
| Compliance Reporting | Compliance Officer | DSP evidence package process | DSP evidence index, audit submission tracker |
| Oversight & Governance | Compliance Steering Committee | Quarterly review meetings, executive dashboards | Meeting minutes, governance dashboards |

## Maintenance
- Review and update ownership assignments quarterly.
- Evidence sources must be accessible within 2 clicks for audit readiness.
- Track updates in Jira project `DSP-READINESS` with change history preserved.
