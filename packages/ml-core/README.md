# ml-core

The `ml-core` package centralises machine-learning feature engineering and experiment
tracking logic for APGMS. It is structured as a Poetry project so it can be installed as a
standalone dependency in notebooks, services, or scheduled jobs that need access to
feature pipelines or shared utilities.

## Installation

```bash
poetry install
```

or, if you prefer `uv`:

```bash
uv sync
```

## Layout

- `src/ml_core/features/`: Composable feature pipelines backed by production Prisma
  queries.
- `src/ml_core/experiments/`: Utilities that help notebooks track experiments without
  requiring a full MLOps stack.
