"""Training pipeline for BAS configuration approval prediction.

This script trains a gradient boosting model to predict whether a
configuration change is OK or needs review. It expects a CSV dataset with the
following schema::

    period,box,value,tx_count,merchant_diversity,stdev_amt,
    prior_delta_pct,reversal_share,manual_share,corrected_last_period,label_ok

All features are numeric and label_ok is 1 when the change is OK and 0 when it
needs review.

The script will:

* split the data into train/validation/test partitions
* train a preprocessing + GradientBoostingClassifier pipeline
* determine the optimal classification threshold based on validation data
* evaluate the model on the hold-out test set
* emit the trained model (with metadata) to ``model.joblib``
* emit evaluation metrics, including band confusion tables, to ``metrics.json``

The trained model is persisted with the preprocessing pipeline and metadata so
that downstream consumers can load the exact transformer + estimator bundle.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

RANDOM_STATE = 1337
BAND_THRESHOLDS = {
    "red_upper": 0.70,   # scores < 0.70 => red
    "green_lower": 0.85,  # scores >= 0.85 => green
}


@dataclass
class BandSummary:
    """Confusion-style summary for a prediction band."""

    total: int
    ok: int
    needs_review: int
    ok_rate: float
    needs_review_rate: float

    @classmethod
    def from_mask(cls, mask: np.ndarray, labels: np.ndarray) -> "BandSummary":
        selected = labels[mask]
        total = int(selected.size)
        if total == 0:
            return cls(total=0, ok=0, needs_review=0, ok_rate=math.nan, needs_review_rate=math.nan)
        ok = int((selected == 1).sum())
        needs_review = int((selected == 0).sum())
        return cls(
            total=total,
            ok=ok,
            needs_review=needs_review,
            ok_rate=ok / total,
            needs_review_rate=needs_review / total,
        )


@dataclass
class MetricsReport:
    roc_auc: float
    pr_auc: float
    optimal_threshold: float
    f1_at_threshold: float
    val_f1_at_threshold: float
    green_precision: float
    red_needs_review_share: float
    band_summaries: Dict[str, BandSummary]

    def to_json_dict(self) -> Dict[str, object]:
        def clean_value(value: object) -> object:
            if isinstance(value, float) and math.isnan(value):
                return None
            return value

        payload = asdict(self)
        # Convert dataclass instances for JSON serialization
        payload["band_summaries"] = {
            name: {
                key: clean_value(val)
                for key, val in asdict(summary).items()
            }
            for name, summary in self.band_summaries.items()
        }
        for key in [
            "roc_auc",
            "pr_auc",
            "optimal_threshold",
            "f1_at_threshold",
            "val_f1_at_threshold",
            "green_precision",
            "red_needs_review_share",
        ]:
            payload[key] = clean_value(payload[key])
        return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train BAS configuration classifier")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data.csv"),
        help="Path to input CSV containing the training data.",
    )
    parser.add_argument(
        "--model-out",
        type=Path,
        default=Path("model.joblib"),
        help="Destination file for the trained model.",
    )
    parser.add_argument(
        "--metrics-out",
        type=Path,
        default=Path("metrics.json"),
        help="Destination file for the evaluation metrics.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of the dataset reserved for final evaluation.",
    )
    parser.add_argument(
        "--val-size",
        type=float,
        default=0.25,
        help="Fraction of the training split used for validation when tuning thresholds.",
    )
    return parser.parse_args()


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Input dataset not found: {path}")
    df = pd.read_csv(path)
    expected_columns = [
        "period",
        "box",
        "value",
        "tx_count",
        "merchant_diversity",
        "stdev_amt",
        "prior_delta_pct",
        "reversal_share",
        "manual_share",
        "corrected_last_period",
        "label_ok",
    ]
    missing = [col for col in expected_columns if col not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")
    return df[expected_columns].copy()


def build_pipeline(feature_names: Iterable[str]) -> Pipeline:
    numeric_features = list(feature_names)
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", numeric_transformer, numeric_features),
        ]
    )
    model = GradientBoostingClassifier(random_state=RANDOM_STATE)
    return Pipeline(steps=[("preprocessor", preprocessor), ("model", model)])


def select_threshold(y_true: np.ndarray, scores: np.ndarray) -> Tuple[float, float]:
    """Select the probability threshold that maximizes the F1 score for the OK class."""
    precision, recall, thresholds = precision_recall_curve(y_true, scores)
    if thresholds.size == 0:
        # All predictions are the same; fall back to default threshold
        default_threshold = 0.5
        y_pred = (scores >= default_threshold).astype(int)
        return default_threshold, f1_score(y_true, y_pred)

    precision = precision[:-1]
    recall = recall[:-1]
    f1_scores = np.where(
        (precision + recall) > 0,
        2 * precision * recall / (precision + recall),
        0.0,
    )
    best_idx = int(np.argmax(f1_scores))
    return float(thresholds[best_idx]), float(f1_scores[best_idx])


def evaluate_bands(y_true: np.ndarray, scores: np.ndarray) -> Tuple[Dict[str, BandSummary], float, float]:
    red_mask = scores < BAND_THRESHOLDS["red_upper"]
    amber_mask = (scores >= BAND_THRESHOLDS["red_upper"]) & (scores < BAND_THRESHOLDS["green_lower"])
    green_mask = scores >= BAND_THRESHOLDS["green_lower"]

    band_summaries = {
        "red": BandSummary.from_mask(red_mask, y_true),
        "amber": BandSummary.from_mask(amber_mask, y_true),
        "green": BandSummary.from_mask(green_mask, y_true),
    }

    green_total = band_summaries["green"].total
    if green_total == 0:
        green_precision = math.nan
    else:
        green_precision = band_summaries["green"].ok / green_total

    red_total = band_summaries["red"].total
    if red_total == 0:
        red_needs_review_share = math.nan
    else:
        red_needs_review_share = band_summaries["red"].needs_review / red_total

    return band_summaries, green_precision, red_needs_review_share


def main() -> None:
    args = parse_args()

    df = load_dataset(args.input)
    features = [col for col in df.columns if col != "label_ok"]
    X = df[features]
    y = df["label_ok"].astype(int)

    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        stratify=y,
        random_state=RANDOM_STATE,
    )

    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val,
        y_train_val,
        test_size=args.val_size,
        stratify=y_train_val,
        random_state=RANDOM_STATE,
    )

    pipeline = build_pipeline(features)
    pipeline.fit(X_train, y_train)

    val_scores = pipeline.predict_proba(X_val)[:, 1]
    optimal_threshold, val_f1_at_threshold = select_threshold(y_val.to_numpy(), val_scores)

    test_scores = pipeline.predict_proba(X_test)[:, 1]
    test_predictions = (test_scores >= optimal_threshold).astype(int)

    roc_auc = roc_auc_score(y_test, test_scores)
    pr_auc = average_precision_score(y_test, test_scores)
    f1_test_at_threshold = f1_score(y_test, test_predictions)

    band_summaries, green_precision, red_needs_review_share = evaluate_bands(
        y_test.to_numpy(), test_scores
    )

    report = MetricsReport(
        roc_auc=float(roc_auc),
        pr_auc=float(pr_auc),
        optimal_threshold=float(optimal_threshold),
        f1_at_threshold=float(f1_test_at_threshold),
        val_f1_at_threshold=float(val_f1_at_threshold),
        green_precision=float(green_precision) if not math.isnan(green_precision) else math.nan,
        red_needs_review_share=float(red_needs_review_share)
        if not math.isnan(red_needs_review_share)
        else math.nan,
        band_summaries=band_summaries,
    )

    # Persist model and metadata together
    model_payload = {
        "pipeline": pipeline,
        "metadata": {
            "features": features,
            "threshold": optimal_threshold,
            "band_thresholds": BAND_THRESHOLDS,
        },
    }

    os.makedirs(args.model_out.parent, exist_ok=True)
    joblib.dump(model_payload, args.model_out)

    os.makedirs(args.metrics_out.parent, exist_ok=True)
    with args.metrics_out.open("w", encoding="utf-8") as f:
        json.dump(report.to_json_dict(), f, indent=2)


if __name__ == "__main__":
    main()
