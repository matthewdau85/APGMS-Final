# Analytics Data Products

This document describes the append-only analytics store introduced for ingestion
and ledger telemetry, together with the feature engineering and quality control
tooling that depend on it.

## Storage Layout

Two Postgres tables back the analytics workflows. Both are append-only and
optimised for downstream batch processing.

### `AnalyticsEvent`

| Column        | Type         | Description |
| ------------- | ------------ | ----------- |
| `id`          | `TEXT`       | Stable identifier generated at ingest time (defaults to `cuid()`). |
| `orgId`       | `TEXT`       | Foreign key to `Org.id`. All analytics queries scope by organisation. |
| `domain`      | `TEXT`       | Logical domain emitting the record (e.g. `ledger`, `policy`). |
| `source`      | `TEXT`       | Service/component origin such as `apps.phase1-demo` or `worker.designated-reconciliation`. |
| `eventType`   | `TEXT`       | Event taxonomy token (see [Event taxonomy](#event-taxonomy)). |
| `occurredAt`  | `TIMESTAMP`  | When the event occurred in the source system. |
| `recordedAt`  | `TIMESTAMP`  | Write timestamp (defaults to `now()`). Useful for detecting ingestion lag. |
| `payload`     | `JSONB`      | Canonicalised event body. Dates become ISO-8601 strings, `bigint` values become decimal strings. |
| `labels`      | `JSONB`      | Optional lightweight labels/features emitted inline (e.g. violation severity). Missing values store as JSON `null`. |
| `dedupeKey`   | `TEXT`       | Optional caller-supplied key to deduplicate idempotent writes. |
| `createdAt`   | `TIMESTAMP`  | Audit column mirroring `recordedAt` for compatibility with historical exports. |

Indexes on `(orgId, occurredAt)` and `(domain, eventType, occurredAt)` support
both time-sliced and taxonomy-driven queries.

### `AnalyticsFeatureSnapshot`

| Column        | Type         | Description |
| ------------- | ------------ | ----------- |
| `id`          | `TEXT`       | Snapshot identifier. |
| `orgId`       | `TEXT`       | Foreign key to `Org.id`. |
| `windowStart` | `TIMESTAMP`  | Lower bound of the aggregation window (30 days by default). |
| `asOf`        | `TIMESTAMP`  | Watermark representing the latest event considered. |
| `features`    | `JSONB`      | Engineered feature vector (counts, balances, recency metrics). |
| `labels`      | `JSONB`      | Labels derived from current policy outcomes. |
| `createdAt`   | `TIMESTAMP`  | Snapshot creation timestamp. |

Snapshots are append-only; downstream consumers can join on `(orgId, asOf)` to
build training sets or monitor drift.

## Event taxonomy

The initial taxonomy focuses on designated account flows and ledger writes:

| Domain  | Event type                         | Emitted by                                       |
| ------- | ----------------------------------- | ------------------------------------------------ |
| `policy` | `designated_transfer.approved`     | `applyDesignatedAccountTransfer` after a successful credit. |
| `policy` | `designated_transfer.blocked`      | Policy evaluation failures (e.g. withdrawal attempts). |
| `policy` | `designated_reconciliation.generated` | Nightly reconciliation artifact generation. |
| `ledger` | `journal.write`                    | Wrapper around `JournalWriter` inside ingestion/ledger services. |

Additional domains can be onboarded by calling `createAnalyticsEventLogger` from
`domain/ledger` with appropriate defaults.

## Feature engineering job

The worker job `worker/src/jobs/build-analytics-features.ts` materialises
historical features and labels. It aggregates the past 30 days of events into a
single snapshot per organisation, computing metrics such as:

- Counts and total value of approved designated transfers.
- Frequency of blocked transfers (policy violations).
- Recent ledger journal activity (`ledger_journal_30d_count`).
- Aggregate designated account balances.
- Derived labels (`designated_policy_status`, `has_open_designated_violation`,
  `recent_transfer_activity`).

Run the job via the worker CLI:

```bash
pnpm --filter @apgms/worker exec node dist/index.js analytics:features
```

During local development you can run the TypeScript entry point directly:

```bash
node --loader ts-node/esm worker/src/index.ts analytics:features
```

## Data quality checks

Automated checks live under `scripts/data-quality`:

- **Null checks** ensure no analytics events or feature snapshots contain null
  payloads or vectors.
- **Drift checks** compare rolling 7-day event volumes against the previous
  window, flagging >50% swings when the baseline is significant.
- **Label leakage checks** validate snapshot watermarks and guard against
  including post-label events inside the training window.

Execute the suite with:

```bash
pnpm data-quality:check
```

The script prints ✅/❌ status lines for each check and exits non-zero if any
issue is detected, making it suitable for CI gating.

## Extensibility

- Use `createAnalyticsEventLogger(prisma, { domain, source })` to instrument new
  services. It handles JSON normalisation and appends to `AnalyticsEvent`.
- Extend `runAnalyticsFeatureAggregation` with additional feature engineering.
  The job intentionally writes append-only snapshots to preserve historical
  training data.
- Add new quality checks by appending functions in `scripts/data-quality/run.ts`.
