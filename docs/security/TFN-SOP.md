# TFN handling SOP

This standard operating procedure (SOP) defines how Australian Tax File Numbers (TFNs) are collected, stored, retained, and deleted across the APGMS platform. It aligns with OAIC guidance and supports downstream compliance artefacts such as the ASVS mapping and incident playbooks.

## 1. Scope and principles

- Applies to any service that processes identifiers used for tax reporting, including TFNs and derived tokens.
- All access is restricted to authenticated administrators and is logged as a security event.
- Raw TFNs must never be persisted or transmitted in plain text outside of a secure, point-in-time workflow.

## 2. Collection

1. TFNs are collected only during onboarding or mandated verification flows that originate in the admin console.
2. The admin console posts TFNs directly to the API Gateway `/admin/pii/decrypt` handler, which immediately tokenises the value via `tokenizeTFN`. No client-side caching is permitted.
3. Requests must include a valid admin bearer token (`x-admin-token`) and originate from the privileged network segment.

## 3. Storage and protection

- TFNs are transformed into deterministic tokens using HMAC salts and encrypted with AES-256-GCM before being stored. See `services/api-gateway/src/lib/pii.ts` for the implementation.
- Encryption keys and salts are injected at runtime; the materials are sourced from the secrets manager and rotated according to the key management policy.
- Audit hooks record every decrypt or tokenisation event, enabling forensic traceability.

## 4. Retention and minimisation

- TFN tokens live only as long as the associated organisation remains active. Linked records (users, bank lines) are deleted when an organisation is deactivated.
- Tombstoned payloads are retained in the `orgTombstone` table solely for legal traceability and include the deletion timestamp. Access requires the same administrative token as live data.
- Quarterly reviews ensure no TFN-derived fields exist outside sanctioned tables.

## 5. Export and deletion runbook

Follow these steps when fulfilling a subject right or regulator request. The flows rely on the admin data routes exposed by the API Gateway.

### 5.1 Export

1. Authenticate to the admin console with an account in the security group.
2. Issue a `GET /admin/export/:orgId` request with the `x-admin-token` header set.
3. Verify the JSON payload and store it in the encrypted evidence bucket. Notify the requester via the secure channel.

### 5.2 Deletion

1. Confirm the request is authorised (legal ticket + incident commander approval).
2. Issue a `DELETE /admin/delete/:orgId` call with the `x-admin-token` header.
3. Capture the resulting `security_event` log entry and archive it with the case notes.
4. Update the TFN retention register and close the request.

## 6. Exceptions and escalation

- Any deviation must be approved by the CISO and recorded in the risk register.
- Suspected exposure or unauthorised access triggers the Notifiable Data Breach runbook (`runbooks/ndb.md`).

_Last reviewed: {{< today >}}_
