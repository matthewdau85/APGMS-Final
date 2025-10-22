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

## Security and Operations Documentation

- [ASVS control mapping](docs/security/ASVS.md)
- [TFN handling SOP](docs/security/TFN-SOP.md)
- [Status site operations guide](status/README.md)
- [Status page runbook](runbooks/status-page.md)

