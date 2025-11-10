# Notebook Artifacts

This folder stores exploratory artifacts produced by the `ml-core` feature
builders and baseline pipelines. Each dataset builder writes:

- `<dataset>_sample.csv` – five-row sample extracted at build time.
- `<dataset>_profile.json` – schema and null-profile summary metadata.

These artifacts are referenced by MLflow runs and documentation to ensure the
feature snapshot used for modeling is auditable.
