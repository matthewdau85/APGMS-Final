# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

## Local development notes

- Store any developer-provisioned KMS credentials in `artifacts/kms/`. The directory is
  tracked in git via a `.gitkeep`, while the JSON key material is ignored so local keys
  never end up in version control.

## Seed data credentials

The seed script provisions a default admin account for demo purposes. The account email is `founder@example.com`, and the password is hashed before being persisted. Set the `SEED_ADMIN_PASSWORD` environment variable when running `scripts/seed.ts` to control the plaintext value used for hashing (a development-only fallback exists in the script, but production environments should always supply their own secret).
