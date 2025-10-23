# Compliance Checklist

Run these checks before each release and record evidence in the release ticket:

- ✅ `pnpm -r test` – unit/integration + accessibility suites
- ✅ `pnpm -r typecheck` – type safety across services
- ✅ `pnpm k6:smoke -- --env BASE_URL=<env-url>` – runtime smoke
- ✅ `pnpm --filter @apgms/shared exec prisma migrate status --schema prisma/schema.prisma`
- ✅ `pnpm --filter @apgms/api-gateway typecheck` *(included in workspace typecheck)*
- ✅ Confirm DPIA/ASVS docs up to date (`docs/privacy/dpia.md`, `docs/security/ASVS-mapping.md`)
- ✅ Verify CI security workflow succeeded (SBOM, Semgrep, Gitleaks, Trivy)

Store evidence hashes in `artifacts/compliance/<release-tag>.md`.
