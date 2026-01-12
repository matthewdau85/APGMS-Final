# ATO Rules Maintenance Runbook

## 1) Purpose and audience
Operators, developers, and control owners who keep the PAYGW/GST/BAS rules aligned with ATO releases and governance demands. Follow this runbook whenever a new tax year, scenario, or evidence requirement arrives.

## 2) Where ATO rules live in this repo
- `specs/ato/ato-ruleset.v1.json` contains the manifest of PAYGW/GST/BAS requirements.
- `specs/ato/ato-ruleset.schema.v1.json` defines the schema `pnpm validate:ato` enforces.
- `data/ato/v1/` stores scaffolding placeholders (e.g., `paygw/`, `gst/category-map.json`, `bas/due-dates.json`).
- Engines and inputs live under `packages/domain-policy/src/au-tax` and `webapp/src/tax`.
- Look at `package.json` files for the `validate:ato` script, and inspect `infra/prisma/schema.prisma` when DB structures matter.

## 3) Add a new tax year / effective date window
1. Update `specs/ato/ato-ruleset.v1.json` under `effective_dates` with the new `tax_year`, `start`/`end`, and the `required_tables` array.
2. Confirm the schema still accommodates the new entry; update `specs/ato/ato-ruleset.schema.v1.json` if new fields appear.
3. Add placeholder files under `data/ato/v1/paygw/` for every `required_tables` key, ensuring each JSON includes `table_key`, `effective_from`, `effective_to`, `rows: []`, and a `notes` string (e.g., "TODO: import from ATO").
4. When the real tables arrive, place them in the same directory with matching filenames so the validator can find them.
5. Run `pnpm validate:ato` to surface missing tables or schema mismatches before committing.

## 4) Add a new PAYGW scenario/table key
1. Extend `specs/ato/ato-ruleset.v1.json` `paygw.scenarios` section with the new scenario id and metadata (flags, rounding hints, required tables).
2. Update the selector/resolver in `packages/domain-policy/src/au-tax` so it can return the new scenario when inputs match.
3. Create `data/ato/v1/paygw/<new-key>.json` with the expected shape described above.
4. Document any frontend or API impact in `webapp/src/tax` or route docs so stakeholders know how to request the scenario.
5. Run `pnpm validate:ato` to ensure the new key is discoverable.

## 5) Import real ATO tables (placeholder only)
1. Acquire the official ATO data (CSV/JSON) per table.
2. Convert it into the repo format: each JSON file under `data/ato/v1/paygw` should include `table_key`, `effective_from`, `effective_to`, and a `rows` array of objects matching the table schema.
3. Keep the import process manual until a loader exists: place the converted files in `data/ato/v1/paygw/` and reference them from the manifest.
4. After adding real files, re-run `pnpm validate:ato` to ensure the manifest, schema, and data align.

## 6) Run validate:ato and interpret failures
- Script: `pnpm validate:ato` (root `package.json`).
- Failures to expect:
  - Schema validation errors when `specs/ato/ato-ruleset.v1.json` does not match `schema.v1.json`.
  - Missing table errors when `effective_dates.required_tables` references keys not present in `data/ato/v1/paygw`.
  - GST/BAS map gaps if `data/ato/v1/gst/category-map.json` or `data/ato/v1/bas/due-dates.json` lack required entries.
Fix the referenced file, re-run the script, and only proceed when the exit code is 0.

## 7) Safety checklist
- Before changes:
  - `git status` clean for `specs/ato`, `data/ato`, and `packages/domain-policy`.
  - Copy `specs/ato` and scaffolding to a temporary location (if needed) for rollback.
- After changes:
  - `pnpm validate:ato` passes.
  - `git diff` includes only the intended files.
  - Notify the relevant audiences (Operations, DeveloperOperator) via release notes or runbook updates.

## 9) BAS validation stabilization reference
1. The BAS endpoint enforces strict query/body schemas and keeps the original Zod issue message (`"Unrecognized key(s)"`).
2. If you ever adjust `BasLodgmentQuerySchema`/`BasLodgmentBodySchema` or the validation error handler, rerun:
   - `pnpm --filter @apgms/api-gateway test -- bas.validation.test.ts`
   - `pnpm --filter @apgms/api-gateway test` (ensures macros still pass).
3. Confirm `recordBasLodgmentMock` (or the equivalent production call) is mocked via `jest.mock("@apgms/shared", ...)` with proper return shape before touching the handler; that way the route never throws 500 in CI.
4. Document any API changes that stem from stricter validation or added scenarios so downstream teams know to expect `invalid_payload` with details.

## 8) References
- `specs/ato/ato-ruleset.v1.json`
- `specs/ato/ato-ruleset.schema.v1.json`
- `data/ato/v1/paygw/` directory
- `data/ato/v1/gst/category-map.json`
- `data/ato/v1/bas/due-dates.json`
- `packages/domain-policy/src/au-tax`
- `webapp/src/tax`
- `package.json` (validate:ato script)

## Security scan reminders for this runbook
- Run `pnpm run sbom`, `pnpm run gitleaks`, `pnpm run trivy`, and `pnpm validate:ato` after touching dependencies or the `specs/ato` manifest; this is captured in `scripts/run-all-tests.sh` and the CI readiness gate.  
- `pnpm run sbom` requires the legacy `glob` API (now pinned to v7) so CycloneDX can finish; regenerate `sbom.xml` anytime the lockfile changes.  
- `pnpm run gitleaks` uses `gitleaks detect --redact --exit-code 1` (no unsupported flags); rerun before merging to verify there are still no identified secrets.  
- Outstanding alerts (TODO): `qs@6.14.0` via `supertest`/`superagent`, and `@remix-run/router@1.23.0` in the webapp. Update or override these deps when upstream fixes arrive.
