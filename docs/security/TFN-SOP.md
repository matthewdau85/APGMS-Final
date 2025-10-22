# TFN Handling SOP

## Storage & Encryption
- TFNs are tokenised with per-environment salts and stored as HMAC digests (services/api-gateway/src/lib/pii.ts:33).
- Any raw TFN temporarily processed is encrypted with AES-256-GCM envelope keys provided by the KMS configuration (services/api-gateway/src/security/providers.ts:12).

## Access Controls
- Only users with dmin role and matching orgId can request decrypt operations; JWT authentication and anomaly counters enforce rate limits (services/api-gateway/src/app.ts:73).
- Every decrypt/export request triggers an audit log entry and Prometheus security event for downstream alerting (services/api-gateway/src/app.ts:160).

## Key Rotation Procedure
1. Generate new 32-byte key and base64 encode.
2. Update PII_KEYS/PII_ACTIVE_KEY env vars, deploy, and confirm /metrics increments for dmin.org.export after a test request.
3. Retire old key once database re-encryption jobs complete.

## Incident Response
- On suspected TFN leak, revoke JWT credentials, rotate KMS keys, and inspect AuditLog records for the time window (shared/prisma/schema.prisma:47).
- Run security workflow manually to regenerate SBOM and ensure dependencies remain patched (.github/workflows/security.yml:16).

## Review
- SOP reviewed quarterly or after any schema changes to TFN-bearing tables (shared/prisma/schema.prisma:33).
