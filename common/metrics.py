"""Evaluation utilities for binary classification models."""

from __future__ import annotations

from typing import Callable, Dict, Iterable, Mapping, Optional

import numpy as np
import pandas as pd
from sklearn import metrics


def bin_class_metrics(
    y_true: Iterable[int],
    y_prob: Iterable[float],
    threshold: float = 0.5,
) -> Dict[str, float]:
    """Compute common binary classification metrics.

    Returns
    -------
    dict
        Dictionary containing ROC and PR AUCs, precision, recall, F1, accuracy,
        support counts, and the confusion matrix entries (tn, fp, fn, tp).
    """

    y_true_arr = np.asarray(y_true)
    y_prob_arr = np.asarray(y_prob)

    if y_true_arr.shape[0] != y_prob_arr.shape[0]:
        raise ValueError("y_true and y_prob must be the same length")

    if not (0.0 <= threshold <= 1.0):
        raise ValueError("threshold must be within [0, 1]")

    y_pred = (y_prob_arr >= threshold).astype(int)

    auc_roc = metrics.roc_auc_score(y_true_arr, y_prob_arr)
    auc_pr = metrics.average_precision_score(y_true_arr, y_prob_arr)

    tn, fp, fn, tp = metrics.confusion_matrix(y_true_arr, y_pred, labels=[0, 1]).ravel()

    precision = metrics.precision_score(y_true_arr, y_pred, zero_division=0)
    recall = metrics.recall_score(y_true_arr, y_pred, zero_division=0)
    f1 = metrics.f1_score(y_true_arr, y_pred, zero_division=0)
    accuracy = metrics.accuracy_score(y_true_arr, y_pred)

    result = {
        "auc_roc": float(auc_roc),
        "auc_pr": float(auc_pr),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "accuracy": float(accuracy),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "tp": int(tp),
        "support0": int(tn + fp),
        "support1": int(fn + tp),
    }

    return result


def bootstrap_ci(
    fn: Callable[[np.ndarray], float] | Callable[[], float],
    n_boot: int = 200,
    seed: int = 1337,
) -> Mapping[str, float]:
    """Bootstrap confidence interval for a metric function.

    Parameters
    ----------
    fn:
        Metric function. If the callable accepts one positional argument it is
        assumed to be an array of bootstrap indices. The callable may close
        over the original data arrays. When the callable accepts no arguments
        it is executed directly each iteration (assumed to perform its own
        sampling).
    n_boot:
        Number of bootstrap iterations.
    seed:
        Random seed for reproducibility.
    """

    if n_boot <= 0:
        raise ValueError("n_boot must be a positive integer")

    rng = np.random.default_rng(seed)

    import inspect

    signature = inspect.signature(fn)
    expects_arg = len(signature.parameters) > 0

    sample_size: Optional[int] = getattr(fn, "n_samples", None)

    if expects_arg and sample_size is None:
        closure = getattr(fn, "__closure__", None)
        if closure:
            lengths = []
            for cell in closure:
                obj = cell.cell_contents
                try:
                    lengths.append(len(obj))
                except TypeError:
                    continue
            if lengths:
                # Choose the most common length among closure variables.
                values, counts = np.unique(lengths, return_counts=True)
                sample_size = int(values[np.argmax(counts)])

    if expects_arg and sample_size is None:
        raise ValueError(
            "Unable to infer sample size for bootstrap; set `fn.n_samples` manually."
        )

    samples = []
    for _ in range(n_boot):
        if expects_arg:
            assert sample_size is not None  # for type checkers
            indices = rng.integers(0, sample_size, size=sample_size)
            value = fn(indices)
        else:
            value = fn()
        samples.append(float(value))

    mean = float(np.mean(samples))
    low, high = np.percentile(samples, [2.5, 97.5])

    return {"mean": mean, "low": float(low), "high": float(high)}


def calibration_curve_data(
    y_true: Iterable[int],
    y_prob: Iterable[float],
    n_bins: int = 10,
) -> pd.DataFrame:
    """Generate calibration curve summary data."""

    if n_bins <= 0:
        raise ValueError("n_bins must be positive")

    df = pd.DataFrame({"y_true": y_true, "y_prob": y_prob})
    if df.empty:
        return pd.DataFrame(columns=["bin_lower", "bin_upper", "prob_pred", "prob_true", "count"])

    bins = np.linspace(0.0, 1.0, n_bins + 1)
    df["bin"] = pd.cut(df["y_prob"], bins=bins, include_lowest=True)

    agg = (
        df.groupby("bin", observed=True)
        .agg(prob_pred=("y_prob", "mean"), prob_true=("y_true", "mean"), count=("y_true", "size"))
        .reset_index()
    )

    agg["bin_lower"] = agg["bin"].apply(lambda interval: interval.left if hasattr(interval, "left") else np.nan)
    agg["bin_upper"] = agg["bin"].apply(lambda interval: interval.right if hasattr(interval, "right") else np.nan)
    agg = agg.sort_values("bin_lower").reset_index(drop=True)

    return agg[["bin_lower", "bin_upper", "prob_pred", "prob_true", "count"]]


__all__ = ["bin_class_metrics", "bootstrap_ci", "calibration_curve_data"]
