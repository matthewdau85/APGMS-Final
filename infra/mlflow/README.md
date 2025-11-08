# MLflow Infrastructure

This folder documents the infrastructure required for APGMS model training. The GitHub Actions workflow expects an MLflow tracking server with:

- a tracking URI provided through the `MLFLOW_TRACKING_URI` secret;
- an artifact storage bucket (S3 compatible) referenced by the tracking server;
- registry access credentials so that trained models can be versioned.

Provisioning recommendations:

1. Deploy MLflow with object storage (e.g. AWS S3 or Azure Blob Storage) and a managed PostgreSQL backend.
2. Store a service account/API token with write permissions in GitHub secrets (`MLFLOW_TRACKING_URI`, `MLFLOW_TRACKING_USERNAME`, `MLFLOW_TRACKING_PASSWORD`).
3. Configure the `MLFLOW_S3_ENDPOINT_URL`, `MLFLOW_ARTIFACT_AWS_ACCESS_KEY_ID`, and `MLFLOW_ARTIFACT_AWS_SECRET_ACCESS_KEY` secrets when using S3-compatible storage.
4. Provide optional cosign credentials for signed artifact publishing via `ML_COSIGN_PRIVATE_KEY` and `ML_COSIGN_PASSWORD`.

Refer to `values.example.yaml` for a minimal Helm-based deployment skeleton.
