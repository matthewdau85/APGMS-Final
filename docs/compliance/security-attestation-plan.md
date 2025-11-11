# Security and Compliance Attestation Plan

This document captures the actionable plan for completing the requested compliance activities and identifies the artefacts that will be produced for attestation evidence.

## 1. Independent Assessments and Remediation

### Scope
Commission the following third-party reviews:
- Penetration test covering externally exposed services, internal APIs, and administrative interfaces.
- Privacy Impact Assessment (PIA) for customer, employee, and vendor data flows.
- Threat modelling exercise for high-risk workflows (payments, payroll, ML model training, and hosting operations).

### Execution Plan
1. **Vendor selection**: shortlist accredited assessors, execute NDAs, and capture selection rationale.
2. **Pre-engagement preparation**: provide current network diagrams, data inventories, and access lists; schedule testing windows.
3. **Field work**: monitor assessor activities, respond to clarification requests, and triage emergent findings.
4. **Reporting and remediation**: review draft reports, assign remediation owners, and track fixes in the risk register.
5. **Evidence storage**: upload signed statements of work, raw findings, remediation validation, and final reports to `docs/compliance/evidence/`.

### Status Tracking
| Task | Owner | Target Date | Status | Evidence |
| --- | --- | --- | --- | --- |
| Select vendors | Security Lead | _TBD_ | Not started | `evidence/vendor-selection.md` |
| Schedule assessments | PMO | _TBD_ | Not started | `evidence/assessment-schedule.md` |
| Complete remediation | Engineering Leads | _TBD_ | Not started | `evidence/remediation-log.md` |
| Archive reports | Compliance Analyst | _TBD_ | Not started | `evidence/penetration-pia-threatmodel/` |

## 2. ATO DSP Operational Workbooks

### Deliverables
- **Operational Security Workbook** with supporting artefacts (configuration baselines, incident response runbooks).
- **Privacy Workbook** covering data handling, retention, and consent records.
- **Assurance Workbook** summarising control effectiveness, audit trails, and residual risk.

### Execution Plan
1. Map workbook questions to existing policies and controls documented in `docs/compliance/` and `docs/security/`.
2. Collect screenshots, configuration exports, and process descriptions as evidence.
3. Populate the workbooks, ensuring cross-references to evidence files stored under `docs/compliance/evidence/ato-dsp/`.
4. Submit completed workbooks to the Authorising Official and document outcomes and required remediations.
5. Track remediation tasks via the risk register and update status monthly.

### Status Tracking
| Task | Owner | Target Date | Status | Evidence |
| --- | --- | --- | --- | --- |
| Map controls to workbook sections | Compliance Analyst | _TBD_ | Not started | `evidence/ato-dsp/control-matrix.xlsx` |
| Compile evidence package | Security Engineer | _TBD_ | Not started | `evidence/ato-dsp/evidence-index.md` |
| Submit workbooks | Compliance Officer | _TBD_ | Not started | `evidence/ato-dsp/submission-receipt.pdf` |
| Track remediation items | Risk Manager | _TBD_ | Not started | `evidence/ato-dsp/remediation-log.csv` |

## 3. Vendor Agreements and SLAs

### Required Agreements
Execute updated security/data-processing agreements and service level addenda with the following vendor categories:
- Banking partners (treasury and payment settlement).
- Payroll provider.
- Point-of-sale (POS) platform.
- Machine learning tooling vendors.
- Hosting and infrastructure providers.

### Execution Plan
1. Inventory existing agreements and expiration dates in the contract management system.
2. Engage Legal and Procurement to negotiate updated terms covering data handling, breach notification, and availability commitments.
3. Obtain signatures via the approved e-signature workflow.
4. Store signed agreements and amendments in a controlled location and reference them from `docs/compliance/evidence/vendor-agreements/`.
5. Record SLA metrics and reporting cadence in the vendor management playbook.

### Status Tracking
| Task | Owner | Target Date | Status | Evidence |
| --- | --- | --- | --- | --- |
| Inventory current agreements | Procurement Lead | _TBD_ | Not started | `evidence/vendor-agreements/inventory.csv` |
| Negotiate updated DPAs/SLAs | Legal Counsel | _TBD_ | Not started | `evidence/vendor-agreements/negotiation-notes.md` |
| Collect signatures | Vendor Manager | _TBD_ | Not started | `evidence/vendor-agreements/signed/` |
| Centralise artefact storage | Compliance Analyst | _TBD_ | Not started | `evidence/vendor-agreements/readme.md` |

## 4. Automated Key Rotation and Forensic Logging

### Objectives
Implement automated cryptographic key rotation and centralised forensic logging to meet attestation requirements and support observability dashboards.

### Execution Plan
1. **Key Management**
   - Review current key inventory and identify systems lacking automated rotation.
   - Integrate with the organisation's Key Management Service (KMS) or Hardware Security Module (HSM).
   - Define rotation cadence and alerting thresholds; update runbooks.
2. **Forensic Log Aggregation**
   - Catalogue log sources (application, database, infrastructure, authentication).
   - Configure forwarding into the Security Information and Event Management (SIEM) platform with tamper-evident storage.
   - Define retention policies and access controls for forensic artefacts.
3. **Observability Dashboards**
   - Expose metrics for rotation success, key age, logging ingestion rates, and detection alerts.
   - Integrate dashboards into the existing observability suite (Grafana/DataDog/etc.).
4. **Validation and Evidence**
   - Document automated tests or monitoring alerts verifying rotation and log ingestion.
   - Store configuration exports, screenshots, and monitoring reports under `docs/compliance/evidence/key-logging/`.

### Status Tracking
| Task | Owner | Target Date | Status | Evidence |
| --- | --- | --- | --- | --- |
| Baseline current key inventory | Security Engineer | _TBD_ | Not started | `evidence/key-logging/key-inventory.xlsx` |
| Enable automated rotation | Platform Team | _TBD_ | Not started | `evidence/key-logging/rotation-config.yaml` |
| Centralise forensic logs | Observability Team | _TBD_ | Not started | `evidence/key-logging/log-architecture.png` |
| Publish dashboards | SRE | _TBD_ | Not started | `evidence/key-logging/dashboard-screenshots/` |
| Validate attestation evidence | Compliance Analyst | _TBD_ | Not started | `evidence/key-logging/attestation-report.md` |

## Next Steps
- Assign owners and target dates for each task during the next compliance steering meeting.
- Update this plan as progress is made and link to stored evidence in the `docs/compliance/evidence/` directory.

_This repository update documents the plan because direct execution (engaging third parties, executing contracts, and configuring infrastructure) cannot be completed within the confines of this development environment._
