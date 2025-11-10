"""Command line training utility for payroll anomaly detection."""
from __future__ import annotations

import argparse
import json
import os
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

import joblib
import mlflow
from mlflow import sklearn as mlflow_sklearn
import numpy as np
import pandas as pd
import yaml
from mlflow.models.signature import infer_signature
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .feature_engineering import FeatureConfig, select_feature_columns


MLFLOW_TRACKING_URI_ENV = "MLFLOW_TRACKING_URI"


class TrainingError(RuntimeError):
    """Raised when training fails due to invalid configuration or data."""


def _load_config(config_path: Path) -> Dict:
    with config_path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _initialise_mlflow(config: Dict) -> None:
    tracking_uri = os.getenv(MLFLOW_TRACKING_URI_ENV, config.get("model_registry_uri"))
    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)
    experiment_name = config.get("experiment_name")
    if experiment_name:
        mlflow.set_experiment(experiment_name)


def _build_pipeline(
    feature_config: FeatureConfig,
    feature_columns: list[str],
    model_type: str,
    model_params: Dict,
    unsupervised: bool,
) -> Pipeline:
    categorical_transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    numerical_transformer = Pipeline(steps=[("scaler", StandardScaler())])

    categorical_features = [col for col in feature_config.categorical_columns if col in feature_columns]
    datetime_features: list[str] = []
    for column in feature_config.datetime_columns:
        for suffix in ("dayofweek", "day", "month", "year"):
            engineered = f"{column}_{suffix}"
            if engineered in feature_columns:
                datetime_features.append(engineered)
    ratio_features = [col for col in ("withheld_ratio", "super_ratio") if col in feature_columns]
    numerical_features = [col for col in feature_config.numerical_columns if col in feature_columns]
    numerical_features.extend(datetime_features)
    numerical_features.extend(ratio_features)

    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", categorical_transformer, categorical_features),
            ("numerical", numerical_transformer, numerical_features),
        ],
        remainder="drop",
    )

    if unsupervised:
        estimator = IsolationForest(**model_params)
    elif model_type == "gradient_boosting":
        estimator = GradientBoostingClassifier(**model_params)
    else:
        raise TrainingError(f"Unsupported model_type '{model_type}'")

    return Pipeline(steps=[("preprocess", preprocessor), ("model", estimator)])


def train(config_path: Path) -> Dict:
    config = _load_config(config_path)
    training_config = config["training"]
    outputs_config = config["outputs"]

    dataset_path = Path(training_config["dataset_path"]).resolve()
    if not dataset_path.exists():
        raise TrainingError(f"Dataset not found at {dataset_path}")

    df = pd.read_csv(dataset_path)
    feature_config = FeatureConfig(
        datetime_columns=training_config.get("datetime_columns", []),
        categorical_columns=training_config.get("categorical_columns", []),
        numerical_columns=training_config.get("numerical_columns", []),
    )

    features = select_feature_columns(df, feature_config)
    target_column = training_config.get("target_column")
    unsupervised = target_column is None

    X = features
    y: Optional[pd.Series] = None
    if not unsupervised:
        if target_column not in df.columns:
            raise TrainingError(f"Target column '{target_column}' not found in dataset")
        y = df[target_column]

    model_type = training_config.get("model_type", "gradient_boosting")
    model_params = training_config.get(model_type, {})

    _initialise_mlflow(config)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_name = f"{config['tracking']['run_name_prefix']}_{timestamp}"

    artifact_dir = Path(outputs_config["artifact_dir"])
    artifact_dir.mkdir(parents=True, exist_ok=True)

    metrics: Dict[str, float] = {}
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.set_tags(config.get("tracking", {}).get("tags", {}))
        mlflow.log_params({
            "model_type": model_type,
            "unsupervised": unsupervised,
            **model_params,
        })

        feature_columns = list(X.columns)

        if unsupervised:
            pipeline = _build_pipeline(
                feature_config,
                feature_columns=feature_columns,
                model_type=model_type,
                model_params=model_params,
                unsupervised=True,
            )
            pipeline.fit(X)
            predictions = pipeline.predict(X)
            metrics["contamination"] = float(model_params.get("contamination", 0))
            metrics["predicted_outliers"] = float(np.mean(predictions == -1))
        else:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=training_config.get("test_size", 0.2), random_state=training_config.get("random_state", 42)
            )
            pipeline = _build_pipeline(
                feature_config,
                feature_columns=feature_columns,
                model_type=model_type,
                model_params=model_params,
                unsupervised=False,
            )
            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)
            y_proba = pipeline.predict_proba(X_test)[:, 1] if hasattr(pipeline.named_steps["model"], "predict_proba") else None

            metrics["accuracy"] = accuracy_score(y_test, y_pred)
            if y_proba is not None and len(np.unique(y_test)) > 1:
                metrics["roc_auc"] = roc_auc_score(y_test, y_proba)
            report = classification_report(y_test, y_pred, output_dict=True)
            metrics["f1_weighted"] = report["weighted avg"]["f1-score"]

        mlflow.log_metrics(metrics)

        signature = infer_signature(X, pipeline.predict(X) if not unsupervised else pipeline.decision_function(X))

        model_path = artifact_dir / f"{outputs_config['model_file']}"
        joblib.dump(pipeline, model_path)
        mlflow.log_artifact(model_path)
        mlflow_sklearn.log_model(pipeline, artifact_path=config["model_flavor"], signature=signature)

        signature_path = artifact_dir / outputs_config["signature_file"]
        with signature_path.open("w", encoding="utf-8") as fh:
            json.dump(signature.to_dict(), fh, indent=2)
            fh.write("\n")
        mlflow.log_artifact(signature_path)

        metrics_path = artifact_dir / outputs_config["metrics_file"]
        with metrics_path.open("w", encoding="utf-8") as fh:
            json.dump(metrics, fh, indent=2)
            fh.write("\n")
        mlflow.log_artifact(metrics_path)

        model_uri = f"runs:/{run.info.run_id}/{config['model_flavor']}"
        model_name = config.get("model_name")
        if model_name:
            try:
                mlflow.register_model(model_uri, model_name)
            except Exception as exc:  # pragma: no cover - registry may not be reachable in local dev
                warnings.warn(f"Failed to register model '{model_name}': {exc}")

        result = {
            "run_id": run.info.run_id,
            "metrics": metrics,
            "artifacts": {
                "model": str(model_path),
                "signature": str(signature_path),
                "metrics": str(metrics_path),
            },
        }

        run_metadata_path = artifact_dir / "run-metadata.json"
        with run_metadata_path.open("w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2)
            fh.write("\n")

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Train payroll anomaly detection model")
    parser.add_argument("--config", default="ml/config/training.yaml", type=Path, help="Path to YAML training config")
    args = parser.parse_args()

    result = train(args.config)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
