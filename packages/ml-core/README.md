# APGMS ML Core

This package provides the feature engineering and reporting tooling that backs the
compliance automation programme. It is intentionally lightweight so it can be
invoked from workers, notebooks, or CI jobs.

Key capabilities:

- Build structured datasets from `ComplianceTrainingSample` rows and persist them to
  `artifacts/ml-core/` alongside policy metadata.
- Train an XGBoost-based classifier with scikit-learn tooling and record metrics in MLflow.
- Generate fairness, bias, and explainability reports (SHAP) saved under `docs/ml/reports/`.

See `ml_core/pipelines.py` and `ml_core/reporting.py` for entry points.
