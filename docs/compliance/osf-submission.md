# DSP Operational Security Framework Submission
_Last updated: 1 Nov 2025_

This document captures the content submitted to the ATO DSP Operational Security Framework (OSF) portal together with the supporting evidence package stored in `artifacts/osf/2025-11/`.

## 1. Solution Overview
- Product: Automated PAYG Management Service (APGMS)
- Hosting: AWS Sydney (ap-southeast-2) across three availability zones
- Data classification: Official-Sensitive (ATO integration data, TFNs)
- Key integrations: ABR Lookup Service, ATO OSF gateway, PayTo/banking partners

## 2. Authentication & Access Control
- Customer and staff SSO provided via Auth0 with mandatory MFA for privileged roles (`org_admin`, `compliance_admin`, `regulator_full`).
- JWTs include scopes aligned to least privilege. Regulator sessions are short-lived (30 minutes) and audited.
- Break-glass access requires approval via PagerDuty change record and is logged in `security_break_glass` table.
- Evidence: `artifacts/osf/2025-11/auth/diagram.png`, `artifacts/osf/2025-11/auth/mfa-report.pdf`.

## 3. Encryption & Key Management
- Data in transit: TLS 1.3 enforced edge-to-origin using AWS ACM certificates.
- Data at rest: AES-256 encryption for TFN/ABN columns via AWS KMS-managed keys (`kms/apgms-prod-data`).
- Secrets stored in AWS Secrets Manager; rotation runbook documented in `docs/security/secrets-vault.md` with quarterly rotation schedule.
- Evidence: `artifacts/osf/2025-11/encryption/kms-key-metadata.json`, database schema extract demonstrating encrypted columns.

## 4. Audit Logging & Monitoring
- Every API mutation invokes `recordAuditLog` with hash chaining to detect tampering.
- Logs forward to CloudWatch + immutable S3 bucket (`s3://apgms-audit-worm`). TFNs are masked to the pattern `***-***-123` before emission.
- SIEM alerts escalate to Security On-Call within 5 minutes for critical severities.
- Evidence: `artifacts/osf/2025-11/logging/sample-audit-log.json`, `artifacts/osf/2025-11/logging/siem-runbook.pdf`.

## 5. Supply Chain & SDLC
- Third-party libraries scanned daily via `pnpm audit` and Snyk integration. High CVEs trigger deployment block in CI.
- Vendor risk assessments completed for Auth0, AWS, SendGrid, and banking partners; stored in `artifacts/osf/2025-11/vendors/`.
- Deployment pipeline requires signed commits and uses GitHub environments with required reviewers.

## 6. Vulnerability Management
- Quarterly CREST-certified penetration tests (latest report: `artifacts/osf/2025-11/pentest/report.pdf`).
- Weekly dependency patch window tracked in `runbooks/change-calendar.md`.
- Incident response time objective: detection <15 min, containment <1 h, eradication <24 h.

## 7. Personnel Security
- All engineers completed Baseline Vetting (BPSS) and Australian Police Checks within past 12 months.
- Security awareness training delivered quarterly; attendance tracked in `artifacts/osf/2025-11/personnel/training.xlsx`.

## 8. Data Handling & Sovereignty
- Production data confined to ap-southeast-2. Disaster recovery replicas remain in-region with cross-AZ redundancy.
- TFNs accessible only to `compliance_admin` role with just-in-time access via AIMS ticketing.
- Refer to `docs/compliance/data-sovereignty.md` for detailed topology and approvals.

## 9. Incident Response & Reporting
- IR plan stored in `docs/security/IR-playbook.md`; tabletop exercise completed 15 Oct 2025.
- Breach notification workflow integrates with ATO contact list and OAIC guidelines.

## 10. Submission Checklist
- [x] Questionnaire uploaded to OSF portal (ref: `OSF-2025-11-APGMS`).
- [x] Evidence bundle zipped and checksum provided.
- [x] Security executive sign-off (CISO + COO) recorded in DocuSign envelope `eSigned-45b1`.
