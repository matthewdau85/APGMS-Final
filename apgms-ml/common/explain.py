"""Light-weight explainability helpers for classical models."""
from __future__ import annotations

from typing import Iterable, List, Mapping, Sequence, Tuple

import numpy as np
import pandas as pd


def feature_importances(
    *,
    feature_names: Sequence[str],
    importances: Sequence[float],
    top_n: int = 10,
) -> pd.DataFrame:
    """Return a ranked dataframe of feature importances."""
    data = np.asarray(importances, dtype=float)
    names = np.asarray(feature_names, dtype=str)
    order = np.argsort(data)[::-1]
    top_indices = order[:top_n]
    return pd.DataFrame(
        {
            "feature": names[top_indices],
            "importance": data[top_indices],
            "rank": np.arange(1, top_indices.size + 1, dtype=int),
        }
    )


def permutation_report(
    *,
    baseline_score: float,
    perturbed_scores: Mapping[str, Iterable[float]],
) -> List[Tuple[str, float]]:
    """Return mean score deltas for permutation-style experiments."""
    summary: List[Tuple[str, float]] = []
    for feature, scores in perturbed_scores.items():
        series = np.asarray(list(scores), dtype=float)
        if series.size == 0:
            continue
        delta = baseline_score - float(np.mean(series))
        summary.append((feature, delta))
    summary.sort(key=lambda item: item[1], reverse=True)
    return summary
