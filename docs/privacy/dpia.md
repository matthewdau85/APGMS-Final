# Data Protection Impact Assessment (DPIA)

Last updated: 2024-06-01

## Overview

This DPIA covers the Australian tax-file-number (TFN) onboarding flows and bank-statement ingestion pipeline that power the
Birchal SME lending experience. Both features process personal information about directors and finance teams; unauthorised
disclosure would present a material privacy risk to customers and employees.

## Data inventory

| Data asset | Purpose | Storage location | Retention |
| --- | --- | --- | --- |
| TFNs (tokenised) | Match applicants to ATO records for eligibility checks. | `bank_line` and `org` tables in Postgres (tokenised). | 7 years to satisfy AML/CTF obligations. |
| TFNs (encrypted payload) | Support regulatory re-requests from the ATO. | `tfn_secrets` table encrypted with AES-256-GCM. | 30 days, then rotated out of the active key set. |
| Bank statement lines | Underwrite cash-flow and verify GST payments. | `bank_line` table in Postgres. | 7 years to satisfy auditing requirements. |
| Audit events | Detect and investigate privileged access to PII. | `audit_log` stream in Splunk. | 18 months. |

## Data flow and lawful basis

1. Customers consent to TFN and bank access during onboarding (Privacy Act APP 3.3(b)).
2. The web application submits TFNs and bank lines to the API Gateway via mTLS.
3. TFNs are tokenised and encrypted before storage, ensuring that application operators cannot view the raw value without
   breaking key-management procedures. 【services/api-gateway/src/lib/pii.ts#L38-L111】
4. Admins can request an export during regulator inquiries using a one-time `x-admin-token`. Access is restricted to audited
   support staff. 【services/api-gateway/src/app.ts#L101-L152】【services/api-gateway/test/privacy.spec.ts#L34-L94】
5. All privileged decryption requests are logged with actor identifiers for subsequent review. 【services/api-gateway/test/pii.spec.ts#L80-L118】

The lawful basis is contract performance (APP 6.2(b)) and regulatory compliance (AML/CTF, Corporations Act).

## Risk assessment

| Scenario | Likelihood | Impact | Residual risk |
| --- | --- | --- | --- |
| Compromised operator credentials used to export TFNs. | Medium | High | Tokenised storage plus the admin token gate reduce exposure; activity generates audit events reviewed daily. |
| Database breach reveals TFNs. | Low | High | AES-256-GCM encryption with per-record IVs limits blast radius; key rotation is enforced quarterly. |
| Logging leaks personal data. | Medium | Medium | Structured logging masks secrets before persistence, preventing raw TFNs from entering logs. 【services/api-gateway/src/app.ts#L89-L135】【shared/src/masking.ts#L1-L94】 |
| Regulator notification delays post-incident. | Low | Medium | The NDB runbook defines the notification templates and timelines. 【runbooks/ndb.md#L1-L81】 |

Residual risks are accepted by the Data Protection Officer and will be revisited in Q4 FY25 when the platform introduces
self-service admin access.

## Mitigations and follow-up actions

* Complete integration with the identity provider to replace the static admin token with signed admin sessions (Q3 FY24).
* Expand automated regression coverage for PII routes as new jurisdictions are onboarded.
* Annual privacy training for all support staff with export permissions; completion tracked in the LMS.
* Documented DPIA will be reviewed every 12 months or after any material change in processing activities.

## Related artefacts

* ASVS control mapping (security controls inventory). 【docs/security/ASVS-mapping.md#L1-L40】
* Status site runbook for customer communications during incidents. 【status/README.md#L1-L120】
