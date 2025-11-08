# Data Retention & WORM Evidence SOP

This SOP documents how APGMS meets TFN retention rules, DSP evidence
requirements, and the organisation's internal retention schedule.

## Retention schedule

| Data type | Retention period | Disposal method | System enforcement |
| --- | --- | --- | --- |
| Payroll bank lines | 7 years (ATO requirement) | Export to regulator WORM store; redact PII before deletion | Evidence artifacts stored with SHA-256 digests and WORM URIs (`domain/policy/designated-accounts.ts`). |
| TFN tokens & audit logs | 7 years or until contract termination | Automatic deletion via `admin.data.delete` workflow | Route enforces admin approval and anonymisation before removal (`services/api-gateway/src/routes/admin.data.ts`). |
| Regulator session metadata | Active session TTL (default 90 minutes) + 12 months for audit | Session revoke + audit table purge job | Regulator auth guard verifies TTL and rotates sessions on logout (`services/api-gateway/src/routes/regulator-auth.ts`, `services/api-gateway/src/app.ts`). |

## WORM evidence handling

1. **Generate evidence** – Use designated account reconciliation or compliance
   exports to create artifacts; each transaction writes a SHA-256 digest and
   provisional `internal:*` URI (`domain/policy/designated-accounts.ts`).
2. **Promote to immutable storage** – Background jobs update the `wormUri` to the
   immutable location once replication completes
   (`services/api-gateway/src/app.ts`).
3. **Verify integrity** – Regulators and auditors can rerun
   `scripts/regulator-smoke.mjs` or hash downloads via the Evidence Library UI to
   validate digests.
4. **Catalogue evidence** – Record artifact IDs, hashes, and WORM URIs in the
   compliance evidence register.

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

- [ ] Evidence artifacts show `wormUri` promoted from `internal:*` to the
      immutable endpoint.
- [ ] Audit logs include `designatedAccount.reconciliation` and
      `admin.data.delete` entries with SHA-256 metadata.
- [ ] Retention review ticket closed with evidence attachments and reference to
      this SOP.
