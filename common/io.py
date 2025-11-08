"""Input/output utilities for analytics workflows."""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional, Sequence, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer


def read_csv(path: str | os.PathLike[str]) -> pd.DataFrame:
    """Read a CSV file into a dtype-aware :class:`pandas.DataFrame`.

    The helper wraps :func:`pandas.read_csv` and applies
    :meth:`DataFrame.convert_dtypes` to use nullable dtypes when possible.
    This avoids unintended downcasts (e.g. of integers with missing values)
    while remaining broadly compatible with downstream tooling.
    """

    df = pd.read_csv(path)
    # ``convert_dtypes`` keeps nullable types (Int64, boolean, string, etc.)
    # and attempts to infer better datatypes without losing information.
    return df.convert_dtypes()


def train_val_test_split(
    df: pd.DataFrame,
    time_col: Optional[str] = None,
    ratios: Sequence[float] = (0.7, 0.15, 0.15),
    stratify: Optional[Iterable] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split a DataFrame into train/validation/test partitions.

    Parameters
    ----------
    df:
        The input dataframe to split.
    time_col:
        When provided, the dataframe is sorted by this column and split
        sequentially using the desired ratios. This is useful for
        time-series problems where shuffling is undesirable.
    ratios:
        Tuple of ``(train_ratio, val_ratio, test_ratio)``. The ratios are
        normalised if they do not sum to one to provide a forgiving API.
    stratify:
        Optional iterable used for stratification when ``time_col`` is not
        provided. The length must match ``df``.
    """

    if len(ratios) != 3:
        raise ValueError("ratios must be a sequence of three floats")

    total = float(sum(ratios))
    if total <= 0:
        raise ValueError("ratios must sum to a positive value")

    ratios = tuple(r / total for r in ratios)

    if time_col:
        if time_col not in df.columns:
            raise KeyError(f"time column '{time_col}' not in dataframe")

        df_sorted = df.sort_values(time_col, kind="stable").reset_index(drop=True)
        n = len(df_sorted)
        train_end = math.floor(n * ratios[0])
        val_end = math.floor(n * (ratios[0] + ratios[1]))

        # Ensure that every row is assigned by pushing remainder to the test set.
        train_df = df_sorted.iloc[:train_end].copy()
        val_df = df_sorted.iloc[train_end:val_end].copy()
        test_df = df_sorted.iloc[val_end:].copy()
        return train_df, val_df, test_df

    # Randomised split (with optional stratification).
    if stratify is not None and len(df) != len(stratify):
        raise ValueError("stratify iterable must be the same length as df")

    train_ratio, val_ratio, test_ratio = ratios
    temp_ratio = val_ratio + test_ratio
    if temp_ratio == 0:
        raise ValueError("validation and test ratios cannot both be zero")

    df_train, df_temp = train_test_split(
        df,
        test_size=temp_ratio,
        stratify=stratify,
        random_state=42,
        shuffle=True,
    )

    stratify_temp = None
    if stratify is not None:
        stratify_series = pd.Series(stratify, index=df.index)
        stratify_temp = stratify_series.loc[df_temp.index]

    if np.isclose(val_ratio, 0.0):
        df_val = df_temp.iloc[0:0].copy()
        df_test = df_temp.copy()
    elif np.isclose(test_ratio, 0.0):
        df_val = df_temp.copy()
        df_test = df_temp.iloc[0:0].copy()
    else:
        test_fraction = test_ratio / temp_ratio
        df_val, df_test = train_test_split(
            df_temp,
            test_size=test_fraction,
            stratify=stratify_temp.values if stratify_temp is not None else None,
            random_state=42,
            shuffle=True,
        )

    return df_train.copy(), df_val.copy(), df_test.copy()


def save_artifact(
    model,
    out_path: str | os.PathLike[str],
    meta_dict: Optional[dict] = None,
) -> Path:
    """Persist an object alongside a manifest file.

    Parameters
    ----------
    model:
        The Python object to serialise with :mod:`joblib`.
    out_path:
        Destination path for the serialized artifact.
    meta_dict:
        Optional metadata to include in the manifest file.

    Returns
    -------
    :class:`pathlib.Path`
        Path to the saved artifact.
    """

    destination = Path(out_path)
    ensure_dir(destination.parent)

    joblib.dump(model, destination)

    sha256 = _file_sha256(destination)
    manifest = {
        "artifact": destination.name,
        "sha256": sha256,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "meta": meta_dict or {},
    }

    manifest_path = destination.with_name(f"{destination.stem}.manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    return destination


def _file_sha256(path: Path) -> str:
    import hashlib

    hasher = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_text_vectorizer(kind: str = "tfidf", **kwargs) -> TfidfVectorizer:
    """Return a configured text vectorizer.

    Currently only TF-IDF vectorizers are supported, but the helper keeps the
    interface extensible for future additions.
    """

    kind = (kind or "").lower()
    if kind != "tfidf":
        raise ValueError(f"Unsupported vectorizer kind: {kind}")

    defaults = {
        "strip_accents": "unicode",
        "lowercase": True,
        "ngram_range": (1, 2),
        "min_df": 2,
    }
    defaults.update(kwargs)

    return TfidfVectorizer(**defaults)


def ensure_dir(path: Optional[str | os.PathLike[str]]) -> Path:
    """Ensure a directory exists and return it as a :class:`Path`."""

    directory = Path(path) if path is not None else Path.cwd()
    directory.mkdir(parents=True, exist_ok=True)
    return directory


__all__ = [
    "read_csv",
    "train_val_test_split",
    "save_artifact",
    "load_text_vectorizer",
    "ensure_dir",
]
