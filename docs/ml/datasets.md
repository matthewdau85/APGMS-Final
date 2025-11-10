# APGMS Machine Learning Datasets

This document catalogs the feature sets produced by the `ml-core` package.
Each dataset is materialized from Prisma-backed SQL views and validated with
Great Expectations prior to model training. Exploration artifacts (5-row
samples and schema profiles) live under `artifacts/notebooks`.

## Treasury Shortfall Features (`ml_shortfall_features`)

| Column | Type | Description |
| ------ | ---- | ----------- |
| `org_id` | UUID | Organization identifier sourced from Prisma `Org`. |
| `as_of_date` | Date | Statement date for the cash position snapshot. |
| `net_cash_position` | Decimal | Current cash balance across designated accounts. |
| `expected_outflows` | Decimal | Sum of scheduled payments within the lookahead window. |
| `incoming_payments` | Decimal | Confirmed receivables within the lookahead window. |
| `projected_shortfall` | Decimal | Derived shortfall estimate (`expected_outflows - net_cash_position`). |

Extraction strategy:

- Primary source: SQL view `ml_shortfall_features` (PostgreSQL) that aggregates
  ledger balances, scheduled payouts, and receivables.
- Filters: restricted to active organizations with configured treasury policies.
- Refresh cadence: hourly materialized view update orchestrated by the data
  platform job queue.

## Fraud & Anomaly Features (`ml_transaction_anomaly_features`)

| Column | Type | Description |
| ------ | ---- | ----------- |
| `transaction_id` | UUID | Unique identifier for the posted ledger transaction. |
| `org_id` | UUID | Organization identifier. |
| `amount` | Decimal | Signed transaction amount. |
| `running_balance` | Decimal | Balance immediately after the transaction posts. |
| `transaction_type` | String | Normalized transaction type code from Prisma enums. |
| `counterparty_velocity` | Float | Rolling 7-day transaction count for the counterparty. |
| `hour_of_day` | Integer | UTC hour extracted from `created_at`. |
| `zscore_amount` | Float | Standardized transaction amount. |
| `zscore_running_balance` | Float | Standardized running balance. |
| `zscore_counterparty_velocity` | Float | Standardized counterparty velocity. |

Extraction strategy:

- Primary source: SQL view `ml_transaction_anomaly_features` built on top of
  the Prisma `Transaction` table and ledger analytics views.
- Fallback: `/v1/ml/fraud/features` HTTP endpoint (via the API gateway) when the
  analytical view is delayed.
- Refresh cadence: near-real-time; the API endpoint streams the latest postings
  while the view is refreshed every 5 minutes.

## Payment Plan Default Features (`ml_payment_plan_features`)

| Column | Type | Description |
| ------ | ---- | ----------- |
| `plan_id` | UUID | Unique payment plan identifier. |
| `org_id` | UUID | Organization identifier. |
| `plan_status` | Enum | `active`, `delinquent`, or `closed`. |
| `scheduled_payment_count` | Integer | Total number of scheduled installments. |
| `missed_payment_count` | Integer | Count of missed installments to date. |
| `total_balance` | Decimal | Outstanding balance remaining on the plan. |
| `average_payment_amount` | Decimal | Rolling 90-day average payment amount. |
| `missed_payment_ratio` | Float | Derived ratio of missed to scheduled payments. |
| `is_delinquent` | Integer | Binary label used for baseline classification. |

Extraction strategy:

- Source: SQL view `ml_payment_plan_features` joining `PaymentPlan`,
  `Payment`, and `Invoice` Prisma models.
- Business filters: includes active and delinquent plans with at least three
  completed installments.
- API augmentation: optional `/v1/ml/payment-plans/features` endpoint exposes
  the same schema for real-time scoring.

## Data Quality Controls

- Great Expectations validates non-null keys, categorical domains, and minimum
  row counts during feature materialization.
- Summary profiles written to `artifacts/notebooks` are referenced by model
  reports to guarantee traceability to the feature snapshot used for training.
