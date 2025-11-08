"""Feature engineering utilities for payroll anomaly detection models."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import pandas as pd


@dataclass
class FeatureConfig:
    datetime_columns: List[str]
    categorical_columns: List[str]
    numerical_columns: List[str]


def enrich_ratio_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add domain-specific ratios that help highlight anomalous behavior."""
    df = df.copy()
    if {"gross_pay", "payg_withheld"}.issubset(df.columns):
        df["withheld_ratio"] = df["payg_withheld"].replace(0, pd.NA) / df["gross_pay"].replace(0, pd.NA)
        df["withheld_ratio"].fillna(0.0, inplace=True)
    if {"gross_pay", "super_accrued"}.issubset(df.columns):
        df["super_ratio"] = df["super_accrued"].replace(0, pd.NA) / df["gross_pay"].replace(0, pd.NA)
        df["super_ratio"].fillna(0.0, inplace=True)
    return df


def preprocess_dataframe(df: pd.DataFrame, feature_config: FeatureConfig) -> pd.DataFrame:
    """Perform deterministic preprocessing for model training/evaluation."""
    df = enrich_ratio_features(df)

    # Convert datetimes to cyclic features so models can consume them easily.
    for column in feature_config.datetime_columns:
        if column in df.columns:
            dt = pd.to_datetime(df[column], utc=True, errors="coerce")
            df[f"{column}_dayofweek"] = dt.dt.dayofweek
            df[f"{column}_day"] = dt.dt.day
            df[f"{column}_month"] = dt.dt.month
            df[f"{column}_year"] = dt.dt.year

    return df


def select_feature_columns(df: pd.DataFrame, feature_config: FeatureConfig) -> pd.DataFrame:
    """Return the subset of columns that should be passed into the estimator."""
    engineered = preprocess_dataframe(df, feature_config)
    candidate_columns = (
        list(feature_config.numerical_columns)
        + list(feature_config.categorical_columns)
        + [f"{col}_dayofweek" for col in feature_config.datetime_columns if f"{col}_dayofweek" in engineered.columns]
        + [f"{col}_day" for col in feature_config.datetime_columns if f"{col}_day" in engineered.columns]
        + [f"{col}_month" for col in feature_config.datetime_columns if f"{col}_month" in engineered.columns]
        + [f"{col}_year" for col in feature_config.datetime_columns if f"{col}_year" in engineered.columns]
        + ["withheld_ratio" if "withheld_ratio" in engineered.columns else None]
        + ["super_ratio" if "super_ratio" in engineered.columns else None]
    )
    candidate_columns = [col for col in candidate_columns if col]
    missing_columns = [col for col in candidate_columns if col not in engineered.columns]
    if missing_columns:
        raise ValueError(f"Missing engineered columns: {missing_columns}")
    return engineered[candidate_columns]
