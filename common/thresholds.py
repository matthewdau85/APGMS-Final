"""Threshold selection helpers for binary classifiers."""

from __future__ import annotations

from typing import Iterable, Optional

import numpy as np
from sklearn import metrics


VALID_OBJECTIVES = {
    "f1": metrics.f1_score,
    "precision": metrics.precision_score,
    "recall": metrics.recall_score,
    "accuracy": metrics.accuracy_score,
    "balanced_accuracy": metrics.balanced_accuracy_score,
}


def choose_threshold_for_costs(
    y_true: Iterable[int],
    y_prob: Iterable[float],
    max_fp_rate: Optional[float] = None,
    max_fn_rate: Optional[float] = None,
    maximize: str = "f1",
) -> float:
    """Select the best probability threshold subject to cost constraints."""

    y_true_arr = np.asarray(y_true)
    y_prob_arr = np.asarray(y_prob)

    if y_true_arr.shape[0] != y_prob_arr.shape[0]:
        raise ValueError("y_true and y_prob must be the same length")

    if maximize not in VALID_OBJECTIVES:
        raise ValueError(f"Unsupported objective '{maximize}'")

    negatives = np.sum(y_true_arr == 0)
    positives = np.sum(y_true_arr == 1)

    thresholds = np.unique(np.concatenate(([0.0, 1.0], y_prob_arr)))
    thresholds.sort()

    best_threshold = 0.5
    best_score = -np.inf
    objective_fn = VALID_OBJECTIVES[maximize]

    for threshold in thresholds:
        y_pred = predict_with_threshold(y_prob_arr, threshold)
        tn, fp, fn, tp = metrics.confusion_matrix(y_true_arr, y_pred, labels=[0, 1]).ravel()

        fp_rate = fp / negatives if negatives else 0.0
        fn_rate = fn / positives if positives else 0.0

        if max_fp_rate is not None and fp_rate > max_fp_rate:
            continue
        if max_fn_rate is not None and fn_rate > max_fn_rate:
            continue

        if maximize in {"precision", "recall", "f1"}:
            score = objective_fn(y_true_arr, y_pred, zero_division=0)
        else:
            score = objective_fn(y_true_arr, y_pred)
        if score > best_score or (np.isclose(score, best_score) and threshold < best_threshold):
            best_score = score
            best_threshold = float(threshold)

    if best_score == -np.inf:
        raise ValueError("No threshold satisfies the provided constraints")

    return best_threshold


def predict_with_threshold(y_prob: Iterable[float], t: float) -> np.ndarray:
    """Apply a probability threshold and return binary predictions."""

    if not (0.0 <= t <= 1.0):
        raise ValueError("threshold must be within [0, 1]")

    y_prob_arr = np.asarray(y_prob)
    return (y_prob_arr >= t).astype(int)


__all__ = ["choose_threshold_for_costs", "predict_with_threshold"]
