# ml-core

The `ml-core` package provides feature builders, dataset materialisation helpers, and
responsible-AI reporting utilities for the APGMS compliance platform.

## Layout

- `ml_core/feature_builders.py` – load training data from the analytics Postgres database and
  build ML-ready feature frames.
- `ml_core/reports.py` – generate fairness, bias, and explainability artefacts (including SHAP
  summaries) and persist them into `docs/ml/reports/`.

## Usage

```bash
python -m ml_core.feature_builders --output artifacts/datasets/discrepancy_dataset.parquet
python -m ml_core.reports artifacts/datasets/discrepancy_dataset.parquet
```

The reports embed control references back to the DSP Operational Framework so the outputs are
traceable to Phase 1 governance commitments.
