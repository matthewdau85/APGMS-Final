# Security Policy

The APGMS stack enforces designated one-way accounts, hashed audit logs, and multi-factor authentication for privileged access. This document captures the hardened posture after introducing Vault-backed secrets and guided onboarding workflows.

## Contact

- Email: security@yourdomain.example
- PGP: Available on request for coordinated disclosure

## Vault-backed secrets

- Run `pnpm secrets:vault-sync` to push `.env` entries into a HashiCorp Vault KV store. The script posts to `VAULT_SYNC_PATH` using `VAULT_ADDR` and `VAULT_TOKEN`.
- The API gateway imports `services/api-gateway/src/lib/secret-hydrator.ts` before loading configuration. When `SECRETS_PROVIDER=vault`, any env var that starts with `vault://` is resolved through the shared secret manager, ensuring secrets never reside on disk in plaintext.

## Designated account onboarding

- Execute `pnpm setup:wizard` to capture the org ID, PAYGW/GST account numbers, contact emails, and PayTo automation metadata.
- The wizard generates artifacts in `artifacts/onboarding/` that reference the designated account enforcement policy (`applyDesignatedAccountTransfer`) so compliance teams can hand the document to banks/regulators.
- For automated PayTo mandate provisioning, run `pnpm setup:payto artifacts/onboarding/<org>-designated-plan.json`. The helper posts the generated mandate to `APGMS_PAYTO_CONFIG_ENDPOINT`, signs with `PAYTO_SETUP_TOKEN`, and snapshots the HTTP exchange for auditors.

## Reporting & compliance

- `/ato/stp/report` emits Single Touch Payroll payloads, signs them using SHA-256, and logs the submission via `logGovernmentSubmission` for evidence.
- `scripts/pilot-data-seeder.ts` replays demo payroll runs, compliance pre-checks, and STP submissions while recording the trace in `artifacts/pilots/`.
