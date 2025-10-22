# TFN Handling SOP

This standard operating procedure ensures Australian Tax File Numbers (TFNs) are collected, processed, stored, and deleted in compliance with privacy obligations.

## 1. Collection and Handling
- Collect TFNs only when required for authorised use-cases (e.g. payroll onboarding).
- Transmit TFNs over TLS-protected channels and immediately tokenise them in application services using the shared PII library.
- Application handlers must call `tokenizeTFN` so the raw TFN is never persisted or logged; the helper enforces format validation prior to hashing.【F:services/api-gateway/src/lib/pii.ts†L42-L58】
- Automated tests assert that TFN tokens do not reveal the original digits, providing regression coverage for this requirement.【F:services/api-gateway/test/pii.spec.ts†L45-L63】

## 2. Storage and Access Controls
- Store only the salted token returned by `tokenizeTFN`. Persisting raw TFNs or unsalted hashes is prohibited.
- When TFNs must be re-identified (e.g. responding to a regulator), restrict access to the `/admin/pii/decrypt` endpoint to authorised administrators via the guard callback defined in `registerPIIRoutes`.
- The decrypt route requires a positive guard decision and records an audit trail with the acting administrator and key ID, ensuring privileged access is monitored.【F:services/api-gateway/src/lib/pii.ts†L84-L133】【F:services/api-gateway/test/pii.spec.ts†L65-L105】

## 3. Retention and Deletion
- Honour deletion requests by removing the stored TFN tokens and any dependent references from downstream systems. Because the original TFN cannot be reconstructed from the token, deleting the token renders the TFN irrecoverable.
- Where deletion is part of a broader subject access request, follow the administrative export/delete flows to confirm the subject before purging associated records; these flows emit security and access logs for traceability.【F:services/api-gateway/test/admin.data.export.spec.ts†L1-L123】
- Confirm completion by updating the incident or request ticket with the database record references removed and timestamp of deletion.

