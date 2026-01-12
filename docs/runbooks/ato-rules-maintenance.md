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

## 8) References
- `specs/ato/ato-ruleset.v1.json`
- `specs/ato/ato-ruleset.schema.v1.json`
- `data/ato/v1/paygw/` directory
- `data/ato/v1/gst/category-map.json`
- `data/ato/v1/bas/due-dates.json`
- `packages/domain-policy/src/au-tax`
- `webapp/src/tax`
- `package.json` (validate:ato script)
