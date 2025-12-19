# TFN Handling SOP

## Storage & Encryption
- TFNs are tokenised with per-environment salts and stored as HMAC digests (services/api-gateway/src/lib/pii.ts:33).
- Any raw TFN temporarily processed is encrypted with AES-256-GCM envelope keys provided by the KMS configuration (services/api-gateway/src/security/providers.ts:12).

## Access Controls
- Only users with admin role and matching orgId can request decrypt operations; JWT authentication and anomaly counters enforce rate limits (services/api-gateway/src/app.ts:73).
- Every decrypt/export request triggers an audit log entry and Prometheus security event for downstream alerting (services/api-gateway/src/app.ts:160).
- Admin delete/export flows also emit sanitized `security_event` log entries enriched with `correlationId` so you can trace them through `docs/runbooks/admin-controls.md` before matching against the audit log hash.

## Key Rotation Procedure
1. Run `pnpm security:rotate-keys --write-env .env` to generate new JWT/PII key material (dry-run prints to stdout).
2. Securely store the printed private key material and distribute to signing services.
3. Commit and deploy the updated env secrets, then trigger a controlled decrypt/export to confirm Prometheus counters increment.

## Incident Response
- On suspected TFN leak, revoke JWT credentials, rotate KMS keys, and inspect AuditLog records for the time window (infra/prisma/schema.prisma:47).
- Run security workflow manually to regenerate SBOM and ensure dependencies remain patched (.github/workflows/security.yml:16).

## Review
- SOP reviewed quarterly or after any schema changes to TFN-bearing tables (infra/prisma/schema.prisma:33).
