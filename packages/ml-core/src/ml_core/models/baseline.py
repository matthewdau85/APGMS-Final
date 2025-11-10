"""Baseline models used for risk analytics experiments."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import mlflow
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.metrics import (
    PrecisionRecallDisplay,
    average_precision_score,
    classification_report,
)
from sklearn.model_selection import train_test_split

from ..artifacts import write_dataframe
from ..paths import artifact_dir


@dataclass(slots=True)
class TrainingRun:
    """Captured metadata from a training session."""

    name: str
    params: dict[str, float | int | str]
    metrics: dict[str, float]
    artifacts: dict[str, str]
    created_at: datetime


class _OfflineRun:
    """Fallback context manager when MLflow is not available."""

    def __init__(self, name: str):
        self.info = SimpleNamespace(
            run_id=f"offline-{name}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        )

    def __enter__(self) -> "_OfflineRun":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class BaselineTrainer:
    """Train baseline models and persist experiment metadata."""

    def __init__(self, *, tracking_uri: str | None = None, experiment: str = "ml-core-baselines"):
        self._tracking_uri = tracking_uri
        self._experiment = experiment
        self._tracking_enabled = True

        try:
            if tracking_uri:
                mlflow.set_tracking_uri(tracking_uri)
            mlflow.set_experiment(experiment)
        except Exception:
            self._tracking_enabled = False

    def _start_run(self, name: str):
        if self._tracking_enabled:
            try:
                return mlflow.start_run(run_name=name)
            except Exception:
                self._tracking_enabled = False
        return _OfflineRun(name)

    def _log_params(self, params: dict[str, Any]) -> None:
        if self._tracking_enabled:
            try:
                mlflow.log_params(params)
            except Exception:
                self._tracking_enabled = False

    def _log_metrics(self, metrics: dict[str, float]) -> None:
        if self._tracking_enabled:
            try:
                mlflow.log_metrics(metrics)
            except Exception:
                self._tracking_enabled = False

    def _log_artifacts(self, path: Path | str) -> None:
        if self._tracking_enabled:
            try:
                mlflow.log_artifacts(str(path))
            except Exception:
                self._tracking_enabled = False

    @staticmethod
    def _infer_positive_label(y: pd.Series) -> Any:
        """Best-effort heuristic for choosing the positive label for binary targets."""

        labels = list(pd.unique(y.dropna()))
        if not labels:
            msg = "Cannot infer positive label from empty target series."
            raise ValueError(msg)

        if pd.api.types.is_bool_dtype(y):
            return True

        unique_set = set(labels)
        if unique_set.issuperset({0, 1}) and 1 in unique_set:
            return 1

        if pd.api.types.is_numeric_dtype(y):
            return max(labels)

        for candidate in ("1", "true", "True", "yes", "YES", "Yes"):
            if candidate in unique_set:
                return candidate

        if len(labels) == 1:
            return labels[0]

        # Fallback to the last label under the assumption it is the "positive" case.
        return labels[-1]

    def _log_json(self, payload: dict, name: str) -> Path:
        dest = artifact_dir() / f"{name}.json"
        dest.write_text(json.dumps(payload, indent=2, default=str))
        return dest

    def train_shortfall_classifier(
        self,
        features: pd.DataFrame,
        target_column: str,
        *,
        test_size: float = 0.2,
        random_state: int = 42,
    ) -> TrainingRun:
        """Train a gradient boosting model to predict payroll shortfalls."""

        X = features.drop(columns=[target_column])
        y = features[target_column]
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=test_size,
            random_state=random_state,
            stratify=y,
        )

        model = GradientBoostingClassifier(random_state=random_state)

        with self._start_run("shortfall_classifier") as run:
            model.fit(X_train, y_train)
            y_scores = model.predict_proba(X_test)[:, 1]
            avg_precision = average_precision_score(y_test, y_scores)
            report = classification_report(y_test, model.predict(X_test), output_dict=True)
            display = PrecisionRecallDisplay.from_predictions(y_test, y_scores)

            positive_label = self._infer_positive_label(y_test)
            class_key = str(positive_label)
            class_metrics = report.get(class_key)
            if class_metrics is None:
                class_metrics = report.get("weighted avg") or report.get("macro avg")

            if class_metrics is None:
                msg = "classification_report did not return class metrics for evaluation"
                raise ValueError(msg)

            metrics = {
                "average_precision": float(avg_precision),
                "precision_at_threshold": float(class_metrics["precision"]),
                "recall_at_threshold": float(class_metrics["recall"]),
                "positive_label": str(positive_label),
            }

            feature_snapshot = write_dataframe(features, f"shortfall_features_{run.info.run_id}")
            pr_curve_path = artifact_dir() / f"pr_curve_{run.info.run_id}.csv"
            pr_df = pd.DataFrame({"precision": display.precision, "recall": display.recall})
            pr_df.to_csv(pr_curve_path, index=False)

            self._log_params({"test_size": test_size, "random_state": random_state})
            self._log_metrics(metrics)
            self._log_artifacts(artifact_dir())

        payload = {
            "model": "gradient_boosting",
            "metrics": metrics,
            "artifacts": {**feature_snapshot, "pr_curve": str(pr_curve_path)},
        }
        meta_path = self._log_json(payload, f"shortfall_run_{run.info.run_id}")

        return TrainingRun(
            name="shortfall_classifier",
            params={"test_size": test_size, "random_state": random_state},
            metrics=metrics,
            artifacts={**feature_snapshot, "pr_curve": str(pr_curve_path), "metadata": str(meta_path)},
            created_at=datetime.utcnow(),
        )

    def train_fraud_detector(
        self,
        features: pd.DataFrame,
        *,
        contamination: float = 0.05,
        random_state: int = 42,
    ) -> TrainingRun:
        """Train an isolation forest for anomaly/fraud detection."""

        model = IsolationForest(contamination=contamination, random_state=random_state)

        with self._start_run("fraud_detector") as run:
            model.fit(features)
            scores = model.decision_function(features)
            threshold = np.quantile(scores, contamination)
            metrics = {
                "score_threshold": float(threshold),
                "score_mean": float(np.mean(scores)),
                "score_std": float(np.std(scores)),
            }

            feature_snapshot = write_dataframe(features, f"fraud_features_{run.info.run_id}")

            self._log_params({"contamination": contamination, "random_state": random_state})
            self._log_metrics(metrics)
            self._log_artifacts(artifact_dir())

        payload = {
            "model": "isolation_forest",
            "metrics": metrics,
            "artifacts": feature_snapshot,
        }
        meta_path = self._log_json(payload, f"fraud_run_{run.info.run_id}")

        return TrainingRun(
            name="fraud_detector",
            params={"contamination": contamination, "random_state": random_state},
            metrics=metrics,
            artifacts={**feature_snapshot, "metadata": str(meta_path)},
            created_at=datetime.utcnow(),
        )


__all__ = ["BaselineTrainer", "TrainingRun"]
