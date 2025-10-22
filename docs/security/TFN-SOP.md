# TFN handling SOP

This runbook covers how we collect, store, redact, and export/delete Australian Tax File Numbers (TFNs) across the platform.

## Collection
- TFNs are only accepted through back-office admin tools that call the API gateway; validation is performed client-side using the shared TFN checksum helper before requests are sent. See [`shared/au/tfn.ts`](../../shared/au/tfn.ts#L1-L21).
- Any inbound TFN must be normalized to digits-only form. Forms that accept TFNs must call `normalizeTfn` before passing data to services to keep logs free of untrusted formatting.
- Support cannot collect TFNs over chat or email. Direct administrators to the authenticated workflow or use the export/delete procedure below if corrections are required.

## Storage
- Live services never persist the raw TFN. The API gateway tokenizes TFNs using a keyed HMAC before writing to storage; refer to [`tokenizeTFN`](../../services/api-gateway/src/lib/pii.ts#L47-L64).
- When TFN-like values must be encrypted (e.g. for offline processing) we call [`encryptPII`](../../services/api-gateway/src/lib/pii.ts#L66-L82) with a 32-byte AES key supplied by the configured KMS implementation. Keys are stubbed in local development for clarity.
- Automated tests cover the no-plaintext guarantee—see [`services/api-gateway/test/pii.spec.ts`](../../services/api-gateway/test/pii.spec.ts#L54-L80).

## Redaction
- To redact a TFN token, generate a replacement token with `tokenizeTFN("000 000 000")` and overwrite the stored value. This ensures downstream lookups fail while preserving schema integrity.
- Requests to decrypt TFN-backed payloads must go through the admin-only PII endpoint, which enforces a guard and emits an audit log. See [`registerPIIRoutes`](../../services/api-gateway/src/lib/pii.ts#L108-L147).
- All audit events are reviewed weekly; events are written without the decrypted payload and include key identifiers for traceability.

## Export or Delete Runbook
1. Confirm the requester's authority (must be an admin) and capture a case link.
2. Use the admin subject export endpoint to fetch the user and relationship counts. The route validates payloads with Zod schemas—see [`services/api-gateway/src/routes/admin.data.ts`](../../services/api-gateway/src/routes/admin.data.ts#L134-L156) and [`services/api-gateway/src/schemas/admin.data.ts`](../../services/api-gateway/src/schemas/admin.data.ts#L1-L36).
3. If deletion is required, execute the `/admin/delete/:orgId` workflow with the `x-admin-token` header configured in secrets. This triggers tombstone creation and cascaded cleanup backed by tests in [`services/api-gateway/test/privacy.spec.ts`](../../services/api-gateway/test/privacy.spec.ts#L53-L104).
4. After the API responds, verify the audit log stream and attach the tombstone payload to the case notes.
5. Update the status page per [status/README.md](../../status/README.md) if customer-visible impact occurred.
