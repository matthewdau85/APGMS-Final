# Secrets Management Runbook

## Purpose
Document where the secrets live, how they are rotated, and how to ensure the audit chain stays intact when keys change.

## Secrets inventory
- **JWT keys** (`AUTH_JWKS`, `AUTH_DEV_SECRET`, `REGULATOR_JWT_AUDIENCE`): signing/verifying credentials loaded in `services/api-gateway/src/config.ts`.
- **PII keyset** (`PII_KEYS`, `PII_ACTIVE_KEY`, `PII_SALTS`, `PII_ACTIVE_SALT`): used by `shared/src/pii.ts` when tokenising TFNs/PIIs.
- **Envelope key** (`ENCRYPTION_MASTER_KEY`): used by `shared/src/crypto/envelope.ts` for AES-256-GCM envelopes stored in the database.
- **Database URLs** (`DATABASE_URL`, `SHADOW_DATABASE_URL`), `REDIS_URL`, `NATS_*`, and `WEBAPP_PORT`: treated as secrets for connection strings or endpoints.
- **Operational toggles** (`REQUIRE_TLS`, `AUTH_FAILURE_THRESHOLD`, `CORS_ALLOWED_ORIGINS`): stored in `.env` but still sensitive, so keep them in secured vaults (e.g., HashiCorp or cloud secret manager).
- **PayTo credentials** (`PAYTO_PROVIDER`, `PAYTO_PROVIDER_BASE_URL`, `PAYTO_PROVIDER_SECRET_PATH` or `PAYTO_<PROVIDER>_CREDENTIALS`): loaded by the onboarding + PayTo mandate flow (services/api-gateway/src/lib/payto-client.ts, providers/payto/*).

## Rotation procedures
1. Run `pnpm security:rotate-keys --write-env .env` to generate new PII key material and print encrypted secrets (`scripts/rotate-pii-keys.mjs`). Review the output for `PII_KEYS` and `PII_SALTS`.
2. Update the deployment secrets store (Vault/Key Vault/Secrets Manager) with the new values and leak the `AUTH_JWKS`, `ENCRYPTION_MASTER_KEY`, `PII_KEYS`, and `PII_SALTS` entries.
3. Trigger `pnpm --filter @apgms/shared generate` if the Prisma schema touches secrets tables.
4. Restart the API gateway so it picks up the new secrets, then run `pnpm run backup:evidence-pack` to capture the new audit artefacts and stash the pack alongside the rotated keys.

## Recovery & audits
- If a secret leaks, immediately revoke JWT tokens by rotating `AUTH_JWKS` and `AUTH_DEV_SECRET`, and rotate the PII keys (`PII_KEYS`/`PII_SALTS`).
- Use `shared/src/logging.ts` and `shared/src/redaction.ts` to verify that the rotated keys do not leak into logs; review the `auditLog` table for the `hash` chain (see `shared/prisma/migrations`) and re-run `scripts/collect-evidence.mjs` to produce a fresh evidence snapshot.
- The `.env.example` file documents every environment variable; keep it in sync with this runbook so new team members know what to provision.

### PayTo secret flow

- Production deployments **must** point `PAYTO_PROVIDER` at the bank adapter in use (e.g. `nab` or `anz`) and place the JSON blob `{ "apiKey": "...", "clientId": "..." }` in Vault under the `PAYTO_PROVIDER_SECRET_PATH` configured per environment. The providers read secrets exclusively via `createSecretManager` so no API keys live in `.env`.
- Lower environments can omit the secret path altogether; the system automatically falls back to the `mock` provider, which logs the mandate metadata without calling any external API. This limitation is necessary until bank sandboxes issue usable credentials, and is documented here so auditors understand why `mock` may be present outside prod.
