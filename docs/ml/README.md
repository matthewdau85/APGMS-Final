# Machine Learning Evaluation Criteria

This document captures the criteria agreed with stakeholders for the
risk-focused machine learning initiatives being incubated inside `ml-core`.

## Use cases

1. **Payroll shortfall prediction** – supervised classification model that
   forecasts the likelihood of an employer missing upcoming payroll
   obligations.
2. **Fraudulent behaviour detection** – unsupervised anomaly detection across
   ledger and reconciliation signals to surface high-risk organisations for
   manual review.

## Data readiness checkpoints

Before training or scoring, the following data quality thresholds must be met:

- ≥ 95% of journals within the lookback window must include balanced postings.
- No more than 2% of pay runs can have missing payment dates.
- Reconciliation alerts require a resolution status within 14 days of closure.
- Feature extracts must successfully persist to `artifacts/notebooks` in both
  CSV and Parquet formats.

## Evaluation metrics and acceptance thresholds

### Payroll shortfall classifier

- **Primary metric**: area under the precision-recall curve (Average Precision).
- **Acceptance threshold**: Average Precision ≥ 0.72 on the held-out test set.
- **Operational guard-rails**:
  - Precision at the business-configured alert threshold must stay ≥ 0.65.
  - Recall at the same threshold must stay ≥ 0.55.
  - Drift monitoring triggers if the rolling 14-day precision drops by ≥ 0.10.

### Fraud / anomaly detector

- **Primary metric**: anomaly score distribution health (Isolation Forest).
- **Acceptance threshold**: mean anomaly score must be ≥ 0 with standard
  deviation ≤ 0.5 after calibration against the reference cohort.
- **Operational guard-rails**:
  - Contamination rate is capped at 7% to keep review queues manageable.
  - Alerts must correlate with downstream manual investigations ≥ 40% of the
    time.

## Experiment tracking

All experiments must log the following metadata to MLflow (or the
JSON-based fallback when offline):

- Dataset fingerprint (hash of feature export) and extraction timestamp.
- Model hyper-parameters and random seeds.
- Evaluation metrics for train, validation, and test splits (where relevant).
- A permalink to the generated artifact bundle inside `artifacts/notebooks`.

## Review cadence

Model performance is reviewed fortnightly with Risk & Compliance. Models that
fall below thresholds must ship a remediation plan within one sprint, otherwise
new detections cannot be deployed to production.
