"""Baseline training pipelines for APGMS predictive models."""

from __future__ import annotations

import argparse
import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Iterable, Optional

import mlflow
import mlflow.sklearn  # noqa: F401 ensures sklearn flavor registration
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    roc_auc_score,
    r2_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ..config import DataSourceConfig
from ..feature_store.base import FeatureBuilder
from ..feature_store.builders import BuilderFactory, DatasetKind
from ..utils.mlflow_tracking import (
    configure_tracking,
    log_dataframe_preview,
    log_feature_list,
    log_reproducibility_metadata,
    start_run,
)

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class BaselineTrainingConfig:
    experiment_name: str
    run_name: str
    feature_builder: FeatureBuilder
    target_column: str | None
    tracking_uri: str | None = None
    random_state: int = 42
    test_size: float = 0.2


@dataclass(slots=True)
class BaselineResult:
    run_id: str
    metrics: Dict[str, float]
    artifact_uri: str


def _split_features_labels(frame: pd.DataFrame, target_column: str) -> tuple[pd.DataFrame, pd.Series]:
    if target_column not in frame:
        raise KeyError(f"Target column '{target_column}' missing from feature dataset")
    features = frame.drop(columns=[target_column])
    labels = frame[target_column]
    return features, labels


def _ensure_numeric(frame: pd.DataFrame, exclude: Iterable[str] | None = None) -> pd.DataFrame:
    exclude = set(exclude or [])
    numeric_columns = [col for col in frame.columns if col not in exclude and pd.api.types.is_numeric_dtype(frame[col])]
    return frame[numeric_columns]


def train_shortfall_regression(config: BaselineTrainingConfig) -> BaselineResult:
    configure_tracking(config.tracking_uri)
    dataset = config.feature_builder.build()
    log_dataframe_preview("shortfall", dataset)
    log_feature_list(dataset.columns)

    features, labels = _split_features_labels(dataset, config.target_column or "projected_shortfall")
    numeric_features = _ensure_numeric(features)

    X_train, X_test, y_train, y_test = train_test_split(
        numeric_features,
        labels,
        test_size=config.test_size,
        random_state=config.random_state,
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", LinearRegression()),
    ])

    with start_run(config.experiment_name, config.run_name, tags={"task": "shortfall_regression"}) as active_run:
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)
        rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))
        mae = float(mean_absolute_error(y_test, predictions))
        r2 = float(r2_score(y_test, predictions))

        metrics = {"rmse": rmse, "mae": mae, "r2": r2}
        mlflow.log_metrics(metrics)
        mlflow.sklearn.log_model(pipeline, artifact_path="model")
        log_reproducibility_metadata(random_state=config.random_state)

    return BaselineResult(active_run.info.run_id, metrics, active_run.info.artifact_uri)


def train_fraud_anomaly_detection(config: BaselineTrainingConfig) -> BaselineResult:
    configure_tracking(config.tracking_uri)
    dataset = config.feature_builder.build()
    log_dataframe_preview("fraud", dataset)
    log_feature_list(dataset.columns)

    feature_frame = _ensure_numeric(dataset, exclude=[config.target_column] if config.target_column else None)
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        (
            "model",
            IsolationForest(
                n_estimators=200,
                contamination=0.02,
                random_state=config.random_state,
            ),
        ),
    ])

    with start_run(config.experiment_name, config.run_name, tags={"task": "fraud_detection"}) as active_run:
        pipeline.fit(feature_frame)
        scores = pipeline[-1].score_samples(feature_frame)
        anomaly_threshold = np.percentile(scores, 5)
        predicted_labels = (scores < anomaly_threshold).astype(int)

        metrics = {"anomaly_threshold": float(anomaly_threshold), "mean_score": float(scores.mean())}
        mlflow.log_metrics(metrics)
        with tempfile.TemporaryDirectory() as tmpdir:
            scores_path = Path(tmpdir) / "isolation_forest_scores.npy"
            np.save(scores_path, scores)
            mlflow.log_artifact(str(scores_path), artifact_path="artifacts")
        log_reproducibility_metadata(random_state=config.random_state)

        if config.target_column and config.target_column in dataset:
            true_labels = dataset[config.target_column].astype(int)
            metrics.update(
                {
                    "roc_auc": float(roc_auc_score(true_labels, -scores)),
                    "average_precision": float(average_precision_score(true_labels, -scores)),
                }
            )
            mlflow.log_metrics({k: v for k, v in metrics.items() if k in {"roc_auc", "average_precision"}})

    return BaselineResult(active_run.info.run_id, metrics, active_run.info.artifact_uri)


def train_payment_plan_default(config: BaselineTrainingConfig) -> BaselineResult:
    configure_tracking(config.tracking_uri)
    dataset = config.feature_builder.build()
    target_col = config.target_column or "is_delinquent"
    log_dataframe_preview("payment_plan", dataset)
    log_feature_list(dataset.columns)

    features, labels = _split_features_labels(dataset, target_col)
    feature_frame = _ensure_numeric(features)

    X_train, X_test, y_train, y_test = train_test_split(
        feature_frame,
        labels,
        stratify=labels if len(labels.unique()) > 1 else None,
        test_size=config.test_size,
        random_state=config.random_state,
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler(with_mean=False)),
        (
            "classifier",
            LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=config.random_state,
            ),
        ),
    ])

    with start_run(config.experiment_name, config.run_name, tags={"task": "payment_plan_default"}) as active_run:
        pipeline.fit(X_train, y_train)
        proba = pipeline.predict_proba(X_test)[:, 1]
        preds = (proba >= 0.5).astype(int)

        metrics = {
            "roc_auc": float(roc_auc_score(y_test, proba)),
            "average_precision": float(average_precision_score(y_test, proba)),
            "f1": float(f1_score(y_test, preds)),
            "precision": float(precision_score(y_test, preds)),
            "recall": float(recall_score(y_test, preds)),
        }
        mlflow.log_metrics(metrics)
        mlflow.sklearn.log_model(pipeline, artifact_path="model")
        log_reproducibility_metadata(random_state=config.random_state)

    return BaselineResult(active_run.info.run_id, metrics, active_run.info.artifact_uri)


TRAINERS: Dict[DatasetKind, Callable[[BaselineTrainingConfig], BaselineResult]] = {
    "shortfall": train_shortfall_regression,
    "fraud": train_fraud_anomaly_detection,
    "default_risk": train_payment_plan_default,
}


def build_default_config(kind: DatasetKind, datasource: DataSourceConfig, tracking_uri: str | None = None) -> BaselineTrainingConfig:
    factory = BuilderFactory(datasource)
    if kind == "shortfall":
        builder = factory.create("shortfall")
        target = "projected_shortfall"
    elif kind == "fraud":
        builder = factory.create("fraud")
        target = None
    else:
        builder = factory.create("default_risk")
        target = "is_delinquent"
    return BaselineTrainingConfig(
        experiment_name=f"apgms_{kind}_baseline",
        run_name=f"{kind}_baseline",
        feature_builder=builder,
        target_column=target,
        tracking_uri=tracking_uri,
    )


def main(argv: Optional[Iterable[str]] = None) -> BaselineResult:
    parser = argparse.ArgumentParser(description="Run a baseline training pipeline")
    parser.add_argument("task", choices=list(TRAINERS.keys()))
    parser.add_argument("--database-url")
    parser.add_argument("--api-base-url")
    parser.add_argument("--api-token")
    parser.add_argument("--tracking-uri")
    parser.add_argument("--run-name")
    parser.add_argument("--experiment-name")
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args(list(argv) if argv is not None else None)

    datasource_config = DataSourceConfig(
        database_url=args.database_url,
        api_base_url=args.api_base_url,
        api_token=args.api_token,
    )
    base_config = build_default_config(args.task, datasource_config, tracking_uri=args.tracking_uri)
    base_config.random_state = args.random_state
    base_config.test_size = args.test_size
    if args.run_name:
        base_config.run_name = args.run_name
    if args.experiment_name:
        base_config.experiment_name = args.experiment_name

    trainer = TRAINERS[args.task]
    return trainer(base_config)


if __name__ == "__main__":
    result = main()
    LOGGER.info("Baseline training completed: run_id=%s metrics=%s", result.run_id, result.metrics)
