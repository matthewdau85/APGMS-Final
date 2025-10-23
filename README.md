# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -r typecheck
pnpm -w exec playwright test
pnpm k6:smoke -- --env BASE_URL=http://localhost:3000

## Release compliance
- Follow the checklist in `docs/compliance/checklist.md`; attach evidence for each run.
- Publish dashboard links from `docs/ops/dashboards.md` in the status site when applicable.

## Operational smoke
- Run `pnpm k6:smoke -- --env BASE_URL=http://localhost:3000` after starting the gateway to verify health/readiness endpoints.

## Local development notes

- Store any developer-provisioned KMS credentials in `artifacts/kms/`. The directory is
  tracked in git via a `.gitkeep`, while the JSON key material is ignored so local keys
  never end up in version control.
- Rotate JWT/PII key material with `pnpm security:rotate-keys --write-env .env` (dry-run prints values).


