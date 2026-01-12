# ATO Ruleset Manifest

The canonical ATO ruleset manifest lives in `specs/ato/ato-ruleset.v1.json` and documents the PAYGW, GST and BAS tables plus their effective date windows.

## Extending the manifest
1. Increment `spec_version` whenever you change the structure or add new required tables.
2. Add new `paygw.scenarios`, `flags`, `gst.category_map`, or `bas.due_date_rules` entries when supporting new cases.
3. Append to `effective_dates` for each upcoming tax year, enumerating the minimal `required_tables` that must exist for that window.

## Validation and versioning
A validator (next prompt) checks the manifest and the referenced configuration layers.

```bash
# run validation after editing the manifest
pnpm validate:ato
```

Bump to `ato-ruleset.v2.json` when the schema evolves and document the migration in this guide.

## Config scaffolding (data/ato/v1)

Placeholders live under `data/ato/v1/` so the validator can run before real tables exist:

- `paygw/`: one JSON per table key containing `table_key`, `effective_from`, `effective_to`, and an empty `rows` array.
- `gst/category-map.json`: maps every manifest category to a classification per the spec (`taxable`, `gst_free`, `input_taxed`).
- `bas/due-dates.json`: repeats the due-date rules referenced in the manifest.

Replace these placeholders with actual ATO data imports later, keeping the filenames and keys aligned with `specs/ato/ato-ruleset.v1.json`.
