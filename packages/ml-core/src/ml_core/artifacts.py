"""Helpers for writing feature artifacts to disk."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd

from .paths import artifact_dir


def write_dataframe(df: pd.DataFrame, name: str, formats: Iterable[str] | None = None) -> dict[str, Path]:
    """Persist a dataframe to the artifact directory.

    Parameters
    ----------
    df:
        The dataframe to persist.
    name:
        Base filename (without extension) to use when writing artifacts.
    formats:
        Iterable of formats to produce. Supported values: ``"parquet"``, ``"csv"``.
        Defaults to both.

    Returns
    -------
    dict[str, Path]
        Mapping of format name to the concrete path that was written.
    """

    if formats is None:
        formats = ("parquet", "csv")

    dest = artifact_dir()
    written: dict[str, Path] = {}

    for fmt in formats:
        path = dest / f"{name}.{fmt}"
        if fmt == "parquet":
            df.to_parquet(path, index=False)
        elif fmt == "csv":
            df.to_csv(path, index=False)
        else:
            raise ValueError(f"Unsupported format: {fmt}")
        written[fmt] = path

    return written


__all__ = ["write_dataframe"]
