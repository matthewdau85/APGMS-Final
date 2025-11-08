"""Metrics utilities shared by trainers and evaluators."""
from __future__ import annotations

from typing import Dict, Iterable, Mapping, Sequence

import numpy as np
from sklearn import metrics

RANDOM_STATE = 1337


def classification_metrics(
    *,
    y_true: Sequence[int],
    y_pred: Sequence[int],
    y_score: Sequence[float],
) -> Dict[str, float]:
    """Return a consistent set of binary classification metrics."""
    return {
        "accuracy": float(metrics.accuracy_score(y_true, y_pred)),
        "precision": float(metrics.precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(metrics.recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(metrics.f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(metrics.roc_auc_score(y_true, y_score)),
    }


def regression_metrics(*, y_true: Sequence[float], y_pred: Sequence[float]) -> Dict[str, float]:
    """Return a consistent set of regression metrics."""
    return {
        "mae": float(metrics.mean_absolute_error(y_true, y_pred)),
        "mse": float(metrics.mean_squared_error(y_true, y_pred)),
        "rmse": float(np.sqrt(metrics.mean_squared_error(y_true, y_pred))),
        "r2": float(metrics.r2_score(y_true, y_pred)),
    }


def gate_metrics(
    *,
    metrics_payload: Mapping[str, float],
    thresholds: Mapping[str, float],
) -> Dict[str, bool]:
    """Return a dictionary describing whether each metric meets its threshold."""
    status: Dict[str, bool] = {}
    for metric_name, threshold in thresholds.items():
        metric_value = float(metrics_payload.get(metric_name, float("nan")))
        status[metric_name] = np.isfinite(metric_value) and metric_value >= float(threshold)
    return status


def summarise_gate(status: Mapping[str, bool]) -> bool:
    """Return True when all gates pass."""
    return all(status.values())


def feature_summary(columns: Iterable[str]) -> Dict[str, int]:
    """Return an index lookup for feature names."""
    return {name: idx for idx, name in enumerate(columns)}
