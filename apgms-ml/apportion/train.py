"""Training script for the APGMS apportionment model.

This module trains a LightGBM regressor to predict the percentage of
transaction amounts allocated to a specific user.  It expects a CSV
file with the following columns::

    txn_id, gl_code, merchant, description, amount, user_pct, prior_p95, month, label_pct

The target column ``label_pct`` must be a numeric value between 0 and 1,
representing the fraction of spend attributed to the user.  The script
outputs the trained model (``model.joblib``) and evaluation metrics
(``metrics.json``) that are used by the contract tests.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Tuple

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.feature_extraction.text import TfidfVectorizer

# Default random state used everywhere to make behaviour deterministic
RANDOM_STATE = 1337


@dataclass
class TrainingConfig:
    """Configuration for the training routine."""

    data_path: Path
    model_path: Path
    metrics_path: Path
    test_size: float = 0.2
    random_state: int = RANDOM_STATE

    @classmethod
    def from_args(cls, args: Iterable[str] | None = None) -> "TrainingConfig":
        parser = argparse.ArgumentParser(description="Train the APGMS apportionment model")
        parser.add_argument(
            "--data",
            dest="data_path",
            type=Path,
            required=True,
            help="Path to the training data CSV",
        )
        parser.add_argument(
            "--model-out",
            dest="model_path",
            type=Path,
            default=Path("model.joblib"),
            help="Destination path for the trained model (default: model.joblib)",
        )
        parser.add_argument(
            "--metrics-out",
            dest="metrics_path",
            type=Path,
            default=Path("metrics.json"),
            help="Destination path for the evaluation metrics (default: metrics.json)",
        )
        parser.add_argument(
            "--test-size",
            dest="test_size",
            type=float,
            default=0.2,
            help="Fraction of the dataset reserved for validation (default: 0.2)",
        )
        parser.add_argument(
            "--random-state",
            dest="random_state",
            type=int,
            default=RANDOM_STATE,
            help=f"Seed controlling the data split (default: {RANDOM_STATE})",
        )
        namespace = parser.parse_args(args=args)
        return cls(
            data_path=namespace.data_path,
            model_path=namespace.model_path,
            metrics_path=namespace.metrics_path,
            test_size=namespace.test_size,
            random_state=namespace.random_state,
        )


def load_dataset(path: Path) -> Tuple[pd.DataFrame, pd.Series]:
    """Load the dataset from ``path`` and return the features and target."""
    df = pd.read_csv(path)
    expected_columns = {
        "txn_id",
        "gl_code",
        "merchant",
        "description",
        "amount",
        "user_pct",
        "prior_p95",
        "month",
        "label_pct",
    }
    missing_columns = expected_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Missing expected columns: {sorted(missing_columns)}")

    features = df.drop(columns=["label_pct"]).copy()  # type: pd.DataFrame

    numeric_columns = ["amount", "user_pct", "prior_p95"]
    for column in numeric_columns:
        features[column] = pd.to_numeric(features[column], errors="coerce")

    # Treat identifiers consistently as strings
    string_columns = ["txn_id", "gl_code", "merchant", "description", "month"]
    for column in string_columns:
        if column in features:
            features[column] = features[column].fillna("").astype(str)

    target = pd.to_numeric(df["label_pct"], errors="coerce").astype(float)

    valid_mask = target.notna()
    if not valid_mask.all():
        features = features.loc[valid_mask].reset_index(drop=True)
        target = target.loc[valid_mask].reset_index(drop=True)

    return features, target


def build_pipeline() -> Pipeline:
    """Construct the full preprocessing and modelling pipeline."""
    numeric_features = ["amount", "user_pct", "prior_p95"]
    categorical_features = ["gl_code", "merchant", "month"]

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse=True)),
        ]
    )

    text_pipeline = Pipeline(
        steps=[
            (
                "selector",
                FunctionTransformer(
                    lambda x: x.squeeze(axis=1).astype(str),
                    validate=False,
                ),
            ),
            (
                "vectorizer",
                TfidfVectorizer(
                    max_features=4000,
                    ngram_range=(1, 2),
                    min_df=2,
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, numeric_features),
            ("categorical", categorical_pipeline, categorical_features),
            ("text", text_pipeline, ["description"]),
        ],
        remainder="drop",
        sparse_threshold=0.1,
    )

    regressor = LGBMRegressor(
        random_state=RANDOM_STATE,
        n_estimators=600,
        learning_rate=0.05,
        num_leaves=64,
        min_child_samples=20,
        subsample=0.9,
        colsample_bytree=0.8,
        n_jobs=-1,
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", regressor),
        ]
    )
    return model


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> Tuple[float, float]:
    """Compute the evaluation metrics for the predictions."""
    mae = mean_absolute_error(y_true, y_pred)
    within_10pp = float(np.mean(np.abs(y_true - y_pred) <= 0.10))
    return mae, within_10pp


def save_metrics(path: Path, mae: float, within_10pp: float) -> None:
    """Persist the evaluation metrics as JSON."""
    metrics = {
        "mae": mae,
        "within_10pp": within_10pp,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(metrics, fp, indent=2)


def train(config: TrainingConfig) -> None:
    """Train the LightGBM regressor and write outputs to disk."""
    features, target = load_dataset(config.data_path)

    model = build_pipeline()

    X_train, X_valid, y_train, y_valid = train_test_split(
        features,
        target,
        test_size=config.test_size,
        random_state=config.random_state,
        stratify=None,
    )

    model.fit(X_train, y_train)
    validation_predictions = model.predict(X_valid)
    mae, within_10pp = evaluate_predictions(y_valid.to_numpy(), validation_predictions)

    # Retrain the model on the full dataset to maximise the available data.
    model.fit(features, target)

    config.model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, config.model_path)
    save_metrics(config.metrics_path, mae, within_10pp)

    # Provide a short console summary for convenience.
    print(json.dumps({"mae": mae, "within_10pp": within_10pp}))


if __name__ == "__main__":
    train(TrainingConfig.from_args())
