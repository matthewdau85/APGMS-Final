# Secrets Vault & Rotation Policy
_Last updated: 1 Nov 2025_

## Overview
All sensitive credentials (banking APIs, ABR access tokens, JWT signing keys, encryption master keys) are stored in AWS Secrets Manager. Application services read secrets at runtime through the `getSecret()` helper exported from `packages/config/src/secrets.ts`, which caches values for 5 minutes and automatically refreshes on rotation events published to SNS topic `arn:aws:sns:ap-southeast-2:apgms:secret-rotations`.

## Inventory & Owners
| Secret Name | Purpose | Consuming Services | Owner |
| --- | --- | --- | --- |
| `banking/payto/apiKey` | PayTo initiation + mandate queries | `services/payments`, `worker/payto` | Payments Lead |
| `ato/abr/clientSecret` | ABR Lookup OAuth client secret | `services/onboarding`, `worker/ato-sync` | Compliance Lead |
| `security/jwt/privateKey` | JWT signing (ES256) | `services/auth`, `webapp` SSR | Security Lead |
| `data/kms/masterKey` | Envelope encryption for TFN/ABN columns | `services/payroll`, `worker/reports` | Data Platform |

## Rotation Cadence
- **Quarterly (90 days)**: API keys, OAuth secrets, JWT signing keys.
- **Annual**: KMS customer-managed keys (via new key creation + data re-encryption workflow `kms.rotateEnvelopeKeys`).
- **Event-driven**: Immediate rotation upon incident response trigger, personnel departure, or vendor notice.

## Process
1. Owner raises change request referencing rotation ticket (e.g., `SEC-217`).
2. Update secret in AWS Secrets Manager with staged version; run `scripts/verify-secret-rotation.mjs` to confirm new value works in staging.
3. Publish rotation event to SNS; services subscribed via Lambda invalidate caches.
4. Monitor CloudWatch alarms `SecretsRotationFailure` for anomalies.
5. Document completion in `runbooks/change-log.md` with before/after timestamps (no secret values stored).

## Validation & Testing
- CI job `pnpm test:secrets` ensures `.env` contains only secret identifiers (e.g., `BANKING_API_SECRET_NAME=banking/payto/apiKey`).
- Monthly audit script `tools/audit-secrets.ts` compares deployed infra templates to Secrets Manager inventory to catch drift.
- Rotation tabletop exercise conducted 10 Oct 2025; results filed in `artifacts/security/2025-10/secrets-rotation-report.pdf`.
