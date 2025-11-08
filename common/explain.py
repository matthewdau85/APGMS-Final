"""Model explanation helpers."""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np


def top_tfidf_ngrams(vectorizer, clf, n: int = 25) -> List[Tuple[str, float]]:
    """Return the most informative n-grams from a linear model.

    Parameters
    ----------
    vectorizer:
        A fitted text vectorizer that exposes ``get_feature_names_out``.
    clf:
        A linear classifier with a ``coef_`` attribute (e.g. LogisticRegression).
    n:
        Number of features to return.
    """

    if n <= 0:
        return []

    if not hasattr(vectorizer, "get_feature_names_out"):
        raise AttributeError("vectorizer must implement get_feature_names_out")
    if not hasattr(clf, "coef_"):
        raise AttributeError("classifier must expose coef_ attribute")

    feature_names = vectorizer.get_feature_names_out()
    coefs = getattr(clf, "coef_")

    coefs = np.asarray(coefs)
    if coefs.ndim == 2:
        # For multi-class problems take the last class (positive class in binary).
        if coefs.shape[0] == 1:
            coefs = coefs[0]
        else:
            coefs = coefs[-1]
    elif coefs.ndim != 1:
        raise ValueError("Unexpected coefficient shape")

    if feature_names.shape[0] != coefs.shape[-1]:
        raise ValueError("Number of coefficients does not match feature names")

    feature_pairs = list(zip(feature_names, coefs))
    feature_pairs.sort(key=lambda item: abs(item[1]), reverse=True)
    return feature_pairs[:n]


def pair_feature_debug(row_dict: Dict[str, object]) -> str:
    """Create a deterministic string representation of feature-value pairs."""

    if not row_dict:
        return "<empty>"

    parts = []
    for key in sorted(row_dict):
        value = row_dict[key]
        if isinstance(value, float):
            formatted = f"{value:.6g}"
        else:
            formatted = repr(value)
        parts.append(f"{key}={formatted}")
    return ", ".join(parts)


__all__ = ["top_tfidf_ngrams", "pair_feature_debug"]
