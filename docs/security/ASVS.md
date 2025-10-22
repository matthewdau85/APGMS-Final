# OWASP ASVS L2 Control Mapping

This appendix documents how key OWASP ASVS Level 2 controls are implemented and tested within the APGMS platform.

| Control | Requirement | Implementation | Evidence |
| --- | --- | --- | --- |
| V2.1.1 | Require authentication for administrative APIs. | `services/api-gateway/src/routes/admin.data.ts` validates bearer principals before exporting data. | `services/api-gateway/test/admin.data.export.spec.ts` verifies unauthenticated calls receive `401 Unauthorized`. |
| V2.1.2 | Enforce role-based access for high-privilege actions. | The admin export handler checks the principal role and organisation match before fulfilling the request. | Tests assert that non-admin principals receive `403 Forbidden`. |
| V2.5.2 | Gate sensitive operations behind explicit administrative approval. | `services/api-gateway/src/lib/pii.ts` injects a guard for `/admin/pii/decrypt` before decrypting secrets. | `services/api-gateway/test/pii.spec.ts` exercises both allowed and denied guard paths. |
| V9.1.1 | Protect sensitive data at rest using strong encryption. | `encryptPII` in `services/api-gateway/src/lib/pii.ts` uses AES-256-GCM with per-message IVs and auth tags. | PII unit tests encrypt and decrypt payloads, ensuring ciphertext safety. |
| V9.4.1 | Ensure tax identifiers are irreversibly tokenised. | `tokenizeTFN` normalises TFNs and returns salted HMAC digests. | Tests confirm exported tokens never contain the original TFN digits. |
| V10.3.1 | Generate security audit trails for administrative access. | Admin export routes emit structured entries to access and security logs. | Tests assert that log sinks record `data_export` events with subject metadata. |

