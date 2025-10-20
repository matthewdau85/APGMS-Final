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
