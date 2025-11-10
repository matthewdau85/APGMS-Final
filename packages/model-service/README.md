# @apgms/model-service

Data preparation utilities and feature engineering pipelines for analytical models. The package
focuses on extracting payroll and ledger data from the operational datastore and producing audit-
ready artifacts for downstream model training.

## Available scripts

### Inspect Prisma schema

```
pnpm --filter @apgms/model-service data:inspect
```

Parses `shared/prisma/schema.prisma` and emits a dataset manifest describing which models and
fields feed each analytical dataset. The manifest is stored in
`packages/model-service/artifacts/dataset-manifest.json`.

### Export payroll dataset

```
pnpm --filter @apgms/model-service data:export:payroll -- --source prisma --output ./artifacts/payroll.json
```

Combines employees, pay runs, and payslips into a single JSON payload that can be consumed by the
feature pipeline. Use `--source exports` to load from `data/external/payroll/*.json` exports instead
of a live database. Pass `--include-sensitive` to include encrypted name fields when permissible.

### Generate payroll features

```
pnpm --filter @apgms/model-service pipeline:payroll -- --input ./artifacts/payroll.json --output ./artifacts/features
```

Produces reproducible feature tables with normalization metadata. The pipeline outputs raw and
normalized CSVs along with a JSON metadata file capturing the schema, record counts, and statistics
required for audit trails.
