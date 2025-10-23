# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -r typecheck
pnpm -w exec playwright test

## Operational smoke
- Run `pnpm k6:smoke -- --env BASE_URL=http://localhost:3000` after starting the gateway to verify health/readiness endpoints.

## Local development notes

- Store any developer-provisioned KMS credentials in `artifacts/kms/`. The directory is
  tracked in git via a `.gitkeep`, while the JSON key material is ignored so local keys
  never end up in version control.

