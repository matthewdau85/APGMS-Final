# Data Retention & WORM Evidence SOP

This SOP documents how APGMS meets TFN retention rules, DSP evidence
requirements, and the organisation's internal retention schedule.

## Retention schedule

| Data type | Retention period | Disposal method | System enforcement |
| --- | --- | --- | --- |
| Payroll bank lines | 7 years (ATO requirement) | Export to regulator WORM store; redact PII before deletion | Evidence artifacts stored with SHA-256 digests and internal URIs (`domain/policy/designated-accounts.ts`). |
| TFN tokens & audit logs | 7 years or until contract termination | Automatic deletion via `admin.data.delete` workflow | Route enforces admin approval and anonymisation before removal (`services/api-gateway/src/routes/admin.data.ts`). |
| Regulator session metadata | Active session TTL (default 90 minutes) + 12 months for audit | Session revoke + audit table purge job | Regulator auth guard verifies TTL and rotates sessions on logout (`services/api-gateway/src/routes/regulator-auth.ts`, `services/api-gateway/src/app.ts`). |

## WORM evidence handling

1. **Generate evidence** – Use designated account reconciliation or compliance
   exports to create artifacts; each transaction writes a SHA-256 digest and
   provisional `internal:*` URI (`domain/policy/designated-accounts.ts`).
2. **Catalogue internal URI** – Each artifact retains the `internal:*` `wormUri`
   assigned during the transaction; record this identifier alongside the digest
   in the compliance evidence register.
3. **Export to WORM storage** – During regulator handoffs, export the artifact
   bundle and upload it to the designated immutable store. Capture the exported
   location (e.g. S3 Object Lock bucket URI) in the register entry.
4. **Verify integrity** – Regulators and auditors can rerun
   `scripts/regulator-smoke.mjs` or hash downloads via the Evidence Library UI to
   validate digests.
5. **Catalogue evidence** – Ensure the register links the internal artifact ID,
   SHA-256 digest, and exported WORM location for each record.

## Disposal workflow

1. **Trigger** – Customer termination, data subject deletion request, or
   regulatory retention expiry.
2. **Request approval** – Log a change request referencing the relevant retention
   policy and ticket.
3. **Execute deletion**
   - Run the `POST /admin/data/delete` workflow via the admin portal or CLI.
   - Ensure the confirmation token is signed by an authorised admin.
   - Confirm anonymisation or deletion succeeded via the API response and audit
     log.
4. **Document outcome** – Attach command output and audit extract to
   `artifacts/compliance/<release>.md` and update the retention register.

## Verification checklist

- [ ] Compliance evidence register includes both the recorded `internal:*`
      `wormUri` and the exported WORM location.
- [ ] Audit logs include `designatedAccount.reconciliation` and
      `admin.data.delete` entries with SHA-256 metadata.
- [ ] Retention review ticket closed with evidence attachments and reference to
      this SOP.
