# Data Retention & Deletion Policy
_Effective date: 1 Nov 2025_

## Objectives
- Comply with Australian Privacy Principles, TFN Rule, and ATO record-keeping obligations.
- Ensure personal and financial data are stored no longer than necessary for statutory or contractual requirements.
- Provide auditable processes for purge, archival, and legal hold scenarios.

## Retention Schedule
| Data Category | Examples | Retention Period | Disposal Method | Owner |
| --- | --- | --- | --- | --- |
| Financial records | Payroll transactions, BAS submissions, STP exports | 7 years from lodgement date | Archived to encrypted S3 bucket (`s3://apgms-archive`) with lifecycle purge after expiry | Finance Ops |
| Audit logs | API audit trails, regulator portal activity | 12 months online, 24 months in WORM store | Immutable S3 (WORM) automatically deletes after retention; hash manifest kept | Security |
| TFN/ABN data | Employee TFNs, client ABNs stored in onboarding + payroll tables | Active engagement + 30 days | Encrypted columns truncated via `DELETE ... RETURNING` job; key material rotated | Compliance |
| Support artefacts | Attachments uploaded via support portal | 18 months or until ticket closure + 90 days | Support S3 bucket purge job; notify customer prior to deletion | Customer Support |
| Analytics metrics | Aggregated usage metrics, non-identifiable | 24 months | Redshift VACUUM + unload job | Product Analytics |

## Automated Enforcement
1. **Temporal Workflows**: `retention.cleanupWorkflow` scans eligible records daily and issues batched deletion jobs.
2. **Legal Hold Overrides**: `legal_hold` flag prevents purge; requests tracked in Jira project `LEGALHOLD` and require General Counsel approval.
3. **Verification**: Weekly report emailed to compliance@apgms.com summarising deleted counts per category with checksum comparisons.

## Customer Requests
- Right-to-erasure tickets submitted via support portal trigger workflow `retention.handleDeletionRequest` which validates identity, confirms statutory obligations, and schedules purge within 30 days.
- Confirmation email sent post-completion with reference number.

## Testing & Review
- Dry-run deletion scripts executed in staging monthly; evidence stored in `artifacts/retention/2025-11/test-results.md`.
- Policy reviewed every 6 months by Legal + Security; revisions tracked in Git with change log appended below.

## Change Log
- **v1.0 (Nov 2025)**: Initial release covering financial, audit, TFN, support, and analytics datasets.
