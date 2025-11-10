# ML Core Package

This package centralizes machine learning feature engineering and baseline modeling
capabilities for the APGMS platform. It is designed to be installable via Poetry
or the [`uv`](https://github.com/astral-sh/uv) resolver and exposes utilities for
connecting to the platform's Prisma data sources, validating datasets, persisting
artifacts, and training baseline predictive models.

## Key Features

- Feature builders that source data through SQL views or Prisma-backed APIs and
  persist exploration artifacts in `artifacts/notebooks`.
- Baseline pipelines for
  - shortfall regression,
  - fraud and anomaly detection, and
  - payment plan default classification.
- Tight integration with MLflow for experiment tracking and reproducibility
  metadata capture.
- Dataset quality checks powered by Great Expectations.

## Getting Started

```bash
# Install with Poetry
toolchain use python 3.11
poetry install

# Or with uv
uv pip install -e .
```

To train a baseline model from the repository root:

```bash
cd packages/ml-core
poetry run python -m ml_core.pipelines.baseline shortfall
```

This will materialize features, validate the dataset, log exploratory artifacts
under `artifacts/notebooks`, and register the experiment run in MLflow. See the
module docstrings for additional invocation patterns and configuration options.
