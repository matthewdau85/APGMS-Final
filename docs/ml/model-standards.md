# Model Standards for APGMS ML Systems

This guide defines the minimum acceptance criteria, fairness guardrails, and
documentation expectations for models developed with the `ml-core` package.

## Acceptance Criteria

All production-bound models **must** satisfy the following:

1. **Performance Targets**
   - *Treasury shortfall regression*: RMSE ≤ 12% of median cash position and R² ≥ 0.65 on the validation set.
   - *Fraud/anomaly detection*: ROC-AUC ≥ 0.85 against labeled incidents and average precision ≥ 0.25.
   - *Payment plan default classification*: ROC-AUC ≥ 0.80 and recall ≥ 0.70 for the positive (default) class.
2. **Robustness Checks**
   - Reproduce baseline metrics across 3 random seeds (±0.02 tolerance for metrics).
   - Drift monitoring enabled with population stability index (PSI) alerts > 0.2.
3. **Operational Readiness**
   - MLflow run contains reproducibility metadata (`reproducibility.json`).
   - Model artifacts versioned in the registry with lineage to feature snapshot and code commit.
   - Automated validation suite (Great Expectations) passes on the scoring dataset.

## Fairness & Responsible AI Metrics

| Domain | Metric | Threshold |
| ------ | ------ | --------- |
| Shortfall prediction | Mean Absolute Error parity between bank segments | ≤ 5% relative difference |
| Fraud detection | False positive rate parity across organization tiers | ≤ 3% absolute difference |
| Payment plan default | Equal opportunity (recall parity) across demographic attributes (if available) | ≤ 5% absolute gap |

Additional requirements:

- Sensitive attributes used for fairness evaluation **must not** be included as model features.
- Quarterly fairness audits comparing latest production runs versus historical baselines.
- Document remediation plans for any metric exceeding thresholds above.

## Documentation Templates

Each model release requires the following artifacts checked into `docs/ml/`:

1. **Model Card (`model-card-<model>.md`)**
   - Objective, stakeholders, and decision context.
   - Training data summary (reference `docs/ml/datasets.md`).
   - Performance metrics (validation & backtests).
   - Limitations, known biases, and mitigation strategies.
2. **Validation Report (`validation-<model>.md`)**
   - Data quality validation results (link to Great Expectations outputs).
   - Fairness evaluation table.
   - Stress test scenarios and outcomes.
3. **Operational Runbook (`runbook-<model>.md`)**
   - Deployment targets, rollback steps, and on-call ownership.
   - Monitoring dashboard links and alert thresholds.

Templates should include metadata headers:

```
title: <Model Name>
model_version: <semver>
mlflow_run_id: <run-id>
feature_snapshot: <artifacts/notebooks file>
reviewed_by: <name>
review_date: <ISO8601>
```

## Explainability & Auditability

- Baseline pipelines must log feature importance or contribution artifacts.
  - For linear models, export coefficient tables.
  - For tree-based or ensemble methods, include SHAP summaries.
- Provide end-to-end audit trail linking:
  - MLflow run ID → feature dataset profile → code commit SHA.
  - Access-controlled storage of training datasets with retention ≥ 24 months.
- Every inference service must retain a 90-day decision log capturing input
  features, prediction outputs, and confidence scores for audit purposes.

## Change Management

- Major model updates require sign-off from Risk, Compliance, and Engineering.
- Use GitHub pull requests tagged with `ml-model-change` and attach the updated
  documentation artifacts before merge.
- Schedule post-deployment review within 30 days to evaluate live performance
  against acceptance and fairness criteria.
