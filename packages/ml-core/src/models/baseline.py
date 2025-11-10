"""Baseline model training utilities with MLflow tracking."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, Tuple
import json

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import train_test_split


@dataclass(slots=True)
class BaselineRunSummary:
    """Structured summary of a baseline experiment run."""

    run_id: str
    run_name: str
    model_type: str
    experiment_name: str
    metrics: Dict[str, float]
    parameters: Dict[str, Any]
    timestamp: str


def _tracking_directory() -> Path:
    repo_root = Path(__file__).resolve().parents[3]
    tracking_dir = repo_root / "artifacts" / "notebooks" / "mlruns"
    tracking_dir.mkdir(parents=True, exist_ok=True)
    return tracking_dir


def _log_run_summary(summary: BaselineRunSummary) -> None:
    log_path = _tracking_directory().parent / "baseline_runs.json"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    if log_path.exists():
        try:
            history = json.loads(log_path.read_text())
            if not isinstance(history, list):
                history = []
        except json.JSONDecodeError:
            history = []
    else:
        history = []

    history.append(asdict(summary))
    log_path.write_text(json.dumps(history, indent=2, sort_keys=True))


def train_shortfall_risk_model(
    features: pd.DataFrame,
    target: Sequence[int],
    *,
    tracking_uri: Optional[str] = None,
    experiment_name: str = "shortfall-risk-baseline",
    run_name: Optional[str] = None,
) -> BaselineRunSummary:
    """Train a gradient boosting classifier and log metrics to MLflow."""

    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)
    else:
        mlflow.set_tracking_uri(_tracking_directory().resolve().as_uri())

    mlflow.set_experiment(experiment_name)

    X_train, X_test, y_train, y_test = train_test_split(
        features, target, test_size=0.2, random_state=42, stratify=target
    )
    model = GradientBoostingClassifier(random_state=42)
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    preds = (proba >= 0.5).astype(int)

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, preds, average="binary", zero_division=0
    )
    roc_auc = roc_auc_score(y_test, proba)

    metrics = {
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "roc_auc": float(roc_auc),
    }

    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params(model.get_params())
        mlflow.log_metrics(metrics)
        mlflow.sklearn.log_model(model, artifact_path="model")

    summary = BaselineRunSummary(
        run_id=run.info.run_id,
        run_name=run.info.run_name,
        model_type="gradient_boosting",
        experiment_name=experiment_name,
        metrics=metrics,
        parameters={k: v for k, v in model.get_params().items()},
        timestamp=datetime.utcnow().isoformat(),
    )
    _log_run_summary(summary)
    return summary


def train_anomaly_detection_model(
    features: pd.DataFrame,
    anomaly_labels: Optional[Sequence[int]] = None,
    *,
    tracking_uri: Optional[str] = None,
    experiment_name: str = "anomaly-detection-baseline",
    run_name: Optional[str] = None,
    contamination: float = 0.05,
) -> BaselineRunSummary:
    """Train an isolation forest model to detect anomalies."""

    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)
    else:
        mlflow.set_tracking_uri(_tracking_directory().resolve().as_uri())

    mlflow.set_experiment(experiment_name)

    model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=300,
    )
    model.fit(features)

    scores = model.score_samples(features)
    threshold = float(np.quantile(scores, contamination))

    metrics: Dict[str, float] = {
        "mean_score": float(np.mean(scores)),
        "std_score": float(np.std(scores)),
        "threshold": threshold,
    }

    if anomaly_labels is not None:
        # Convert IsolationForest convention (-1 anomalies, 1 normal) to binary
        predictions = (model.predict(features) == -1).astype(int)
        precision, recall, f1, _ = precision_recall_fscore_support(
            anomaly_labels, predictions, average="binary", zero_division=0
        )
        metrics.update(
            {
                "precision": float(precision),
                "recall": float(recall),
                "f1": float(f1),
            }
        )

    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params({**model.get_params(), "contamination": contamination})
        mlflow.log_metrics(metrics)
        mlflow.sklearn.log_model(model, artifact_path="model")

    summary = BaselineRunSummary(
        run_id=run.info.run_id,
        run_name=run.info.run_name,
        model_type="isolation_forest",
        experiment_name=experiment_name,
        metrics=metrics,
        parameters={k: v for k, v in model.get_params().items()},
        timestamp=datetime.utcnow().isoformat(),
    )
    _log_run_summary(summary)
    return summary


def generate_synthetic_training_data(
    n_samples: int = 800,
    *,
    anomaly_ratio: float = 0.07,
) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Generate synthetic feature data for local experimentation."""

    rng = np.random.default_rng(seed=42)
    ledger_net_flow = rng.normal(loc=5000, scale=2000, size=n_samples)
    payment_on_time_ratio = rng.beta(a=8, b=2, size=n_samples)
    discrepancy_open = rng.poisson(lam=1.5, size=n_samples)
    discrepancy_resolution_hours = rng.gamma(shape=2.0, scale=12.0, size=n_samples)

    features = pd.DataFrame(
        {
            "ledger_net_flow_30d": ledger_net_flow,
            "payment_on_time_ratio": payment_on_time_ratio,
            "discrepancy_open_count": discrepancy_open,
            "discrepancy_avg_resolution_hours": discrepancy_resolution_hours,
        }
    )

    risk_signal = (
        (ledger_net_flow < 2500).astype(int)
        + (payment_on_time_ratio < 0.7).astype(int)
        + (discrepancy_open >= 3).astype(int)
    )
    probability = 1 / (1 + np.exp(-(risk_signal - 1)))
    target = rng.binomial(n=1, p=probability)

    anomaly_count = max(1, int(n_samples * anomaly_ratio))
    anomaly_indices = rng.choice(n_samples, anomaly_count, replace=False)
    anomaly_labels = np.zeros(n_samples, dtype=int)
    anomaly_labels[anomaly_indices] = 1

    features.loc[anomaly_indices, "ledger_net_flow_30d"] *= rng.uniform(0.05, 0.2, size=anomaly_count)
    features.loc[anomaly_indices, "payment_on_time_ratio"] *= rng.uniform(0.1, 0.5, size=anomaly_count)
    features.loc[anomaly_indices, "discrepancy_open_count"] += rng.poisson(
        lam=4, size=anomaly_count
    )

    return features, target.astype(int), anomaly_labels


def _run_demo() -> None:
    features, target, anomaly_labels = generate_synthetic_training_data()
    train_shortfall_risk_model(features, target)
    train_anomaly_detection_model(features, anomaly_labels)


if __name__ == "__main__":
    _run_demo()
