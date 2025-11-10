"""High level orchestration for feature pipelines."""

from __future__ import annotations

import pandas as pd

from .base import FeatureConfig, QueryExecutor
from .discrepancy_metadata import discrepancy_metadata_features
from .ledger_history import ledger_history_features
from .payment_punctuality import payment_punctuality_features


def build_training_set(executor: QueryExecutor, config: FeatureConfig) -> pd.DataFrame:
    """Return a joined training set for the provided organisation.

    The training set currently aggregates ledger statistics, payroll punctuality metrics,
    and reconciliation alert metadata into a single row keyed by ``org_id``.
    """

    frames = [
        ledger_history_features(executor, config),
        payment_punctuality_features(executor, config),
        discrepancy_metadata_features(executor, config),
    ]

    dataset = frames[0]
    for frame in frames[1:]:
        dataset = dataset.merge(frame, on="org_id", how="outer")

    dataset = dataset.fillna(0)
    return dataset


__all__ = ["build_training_set"]
