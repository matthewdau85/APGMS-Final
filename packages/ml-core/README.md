# ML Core

This package contains shared machine learning utilities for APGMS, including:

- Prisma-backed feature pipelines that aggregate ledger, payment, and discrepancy
  data used to train downstream risk models.
- Baseline model training scripts that demonstrate how to capture reproducible
  experiments with MLflow and structured logs.

Install the package locally with [Poetry](https://python-poetry.org/) or `uv`:

```bash
cd packages/ml-core
poetry install
```

Feature pipelines can be invoked from within services that have access to the
primary database. The baseline training script generates synthetic data so teams
can exercise the ML workflow without needing production tables.
