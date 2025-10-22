# Tax File Number (TFN) Handling Standard Operating Procedure

This SOP describes the mandatory controls for collecting, storing, using, and disposing of
Australian Tax File Numbers (TFNs) processed by APGMS. It complements our privacy and
information-security policies and is binding for all employees, contractors, and third-party
processors who interact with TFN data.

## 1. Scope and definitions

- **Systems covered:** production databases, analytics warehouse exports, secure file shares,
  support tooling, and any locally stored evidence that may contain TFNs.
- **TFN data:** a standalone TFN, masked TFN (last three digits obscured), or any document that
  can reasonably reveal the full TFN when combined with other data we control.
- **Authorised roles:** members of the Tax Operations, Compliance, and Engineering Platform
  teams who have an approved access request in AccessHub.

## 2. Collection controls

1. TFNs are only collected through approved customer workflows (`/bank-lines` onboarding and the
   partner SFTP dropbox). Product managers must document new collection points in the data
   inventory before launch.
2. Input forms enforce client-side validation for numeric format and server-side validation that
   rejects non-9 digit values or obvious test numbers (111 111 111) and logs validation telemetry
   to the compliance warehouse.
3. A collection banner explains why the TFN is required, links to the privacy statement, and
   surfaces the latest audit timestamp from the compliance scorecard.
4. For ad-hoc regulator requests, Compliance must approve the collection in a ServiceDesk ticket
   referencing the legal basis.

## 3. Storage and encryption

1. TFNs stored in PostgreSQL are encrypted using the `pgcrypto` extension with AES-256 and a
   per-tenant key managed by AWS KMS. The key alias is `apgms/tfn`. Key usage is monitored via
   CloudTrail and alerts on anomalous patterns.
2. Exports delivered to partners are generated via the `/admin/export/:orgId` API, which masks TFNs
   by default. Analysts requiring the full TFN must justify the need-to-know in the request ticket.
3. TFNs must never be stored in plain text logs. The shared masking utility in `@apgms/shared`
   must wrap any loggable object that could contain TFN fields.
4. Local copies (e.g., spreadsheets) are prohibited unless explicitly authorised. If granted, files
   must be stored in the encrypted "TFN Evidence" drive with automatic 14-day expiry and watermarking.

## 4. Access management

1. AccessHub requests must specify the TFN dataset, duration (max 30 days), and justification.
2. Approvals require both the Data Protection Officer and the relevant team lead.
3. Access reviews run quarterly. Any stale TFN-related grants are revoked automatically and logged
   back to the evidence index.
4. Service accounts interacting with TFNs use scoped API tokens with the `tfn.read` permission only,
   with request signing enforced by AWS SigV4.
5. Session analytics monitor unusual TFN query volume and trigger adaptive MFA challenges.

## 5. Usage and disclosure

1. TFNs are used solely for identity verification and regulator reporting. Any additional purpose
   requires a Data Protection Impact Assessment (DPIA).
2. When TFNs are displayed to authorised staff, the UI must show the first five digits only, with the
   remaining digits masked.
3. Email is never an acceptable channel for TFN sharing. Use SecureShare with link expiry set to
   48 hours.
4. When disclosing to regulators, attach the DPIA or legal instrument that authorises the disclosure.

## 6. Incident response

1. Suspected TFN exposure triggers the Notifiable Data Breach runbook (`runbooks/ndb.md`).
2. Within two hours, the incident commander must:
   - revoke all TFN-related access tokens,
   - capture database snapshots,
   - notify the Privacy Officer and CISO.
3. Root-cause analysis must document whether encryption, masking, or access reviews failed and
   record remediation actions.

## 7. Retention and disposal

1. TFNs are retained only while the customer maintains an active financing relationship plus
   seven years for compliance.
2. The retention job runs nightly and deletes TFNs for accounts flagged `terminated` where the
   retention window has expired. Deletions are logged with hash verification to prove erasure.
3. Partners receiving TFN data must certify destruction annually; signed attestations are stored in
   the compliance evidence vault and surfaced through the customer assurance portal.

## 8. Audit and evidence

- Compliance maintains a control matrix mapping this SOP to APP 11 and ATO requirements.
- Evidence artefacts (access reviews, DPIA approvals, destruction logs) are catalogued in
  `docs/dsp-osf/evidence-index.md` and streamed to the Snowflake partner share.
- Deviations from the SOP require written approval from the CISO and must be documented in the
  exception register. Automated alerts flag any deviation tickets older than seven days.
- Quarterly tabletop exercises validate end-to-end TFN incident handling with cross-functional
  participation.

## 9. Version history

| Version | Date       | Owner              | Notes                                 |
|---------|------------|--------------------|---------------------------------------|
| 1.0     | 2024-10-15 | Security Engineering | Initial comprehensive TFN SOP release |
| 1.1     | 2024-11-01 | Security Engineering | Added telemetry, partner visibility, and adaptive monitoring |

