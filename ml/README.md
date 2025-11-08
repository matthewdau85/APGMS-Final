# ML Training Assets

This directory contains model development assets for the APGMS anomaly detection capability. Assets are structured as follows:

- `config/`: YAML configuration files used by CLI scripts and CI pipelines.
- `data/`: Sample curated datasets used for local development and automated tests.
- `notebooks/`: Jupyter notebooks that document exploratory analysis and provide reproducible experiments.
- `scripts/`: Python modules and command line entry points for training, evaluating, and exporting models.
- `artifacts/`: Output directory for locally generated models and metrics (ignored by Git).

Refer to the `infra/mlflow` documentation for provisioning the remote MLflow tracking and artifact storage backends that power the training workflow.

## Usage

Install dependencies via `pip install -r ml/requirements.txt` and then invoke the CLI tools as Python modules so relative imports resolve correctly:

```bash
python -m ml.scripts.train_model --config ml/config/training.yaml
python -m ml.scripts.evaluate_model --model ml/artifacts/model.joblib --dataset ml/data/curated_payroll_anomalies.csv
```

Model metrics, signatures, and serialized pipelines are written to `ml/artifacts/`. The training script also pushes parameters, metrics, and the model binary to MLflow using the tracking URI configured via environment variables or `config/training.yaml`.
