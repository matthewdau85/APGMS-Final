"""Shared interfaces for feature pipelines."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol

import pandas as pd


class QueryExecutor(Protocol):
    """Protocol for objects that can execute SQL against the production warehouse."""

    def fetch_dataframe(self, query: str, *, params: dict | None = None) -> pd.DataFrame:
        """Return the results of ``query`` as a :class:`pandas.DataFrame`.

        Implementations are expected to honour the parameter style supported by the
        backing driver (named parameters for ``asyncpg``/``psycopg`` for example).
        """


@dataclass(slots=True)
class FeatureConfig:
    """Standard configuration shared across feature builders."""

    org_id: str
    as_of_date: date
    lookback_days: int = 180


def _default_params(config: FeatureConfig) -> dict:
    return {
        "org_id": config.org_id,
        "as_of": config.as_of_date,
        "lookback_days": config.lookback_days,
    }


__all__ = ["QueryExecutor", "FeatureConfig", "_default_params"]
