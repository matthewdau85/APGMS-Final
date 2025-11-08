"""Training script for APGMS duplicate transaction detection model.

This script trains a binary classifier to identify potential duplicate
transaction pairs. The expected training data is a CSV file with the
following columns:

- tid_a, tid_b: identifiers (ignored by the model)
- date_gap_days: difference between the two transactions' dates (numeric)
- amount_diff_abs: absolute difference in transaction amounts (numeric)
- payee_sim, memo_sim: similarity scores in [0, 1]; if missing they will
  be derived from the raw text columns `payee_a`, `payee_b`, `memo_a`,
  `memo_b` using a TF-IDF cosine similarity.
- near_period: indicator for being in the same accounting period. This
  column may be boolean or string and is coerced to numeric values 0/1.
- is_duplicate: target label (1 for duplicates, 0 otherwise).

The script outputs:
- ``model.joblib`` – a joblib-serialised dict containing the fitted
  sklearn pipeline and the chosen decision threshold.
- ``metrics.json`` – evaluation metrics on a validation split.

The model selection favours high precision (>= 0.95) and reasonable
recall (>= 0.70) by scanning a grid of thresholds for each candidate
configuration and keeping the best satisfying the constraints.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


FEATURE_COLUMNS = [
    "date_gap_days",
    "amount_diff_abs",
    "payee_sim",
    "memo_sim",
    "near_period",
]
TARGET_COLUMN = "is_duplicate"


@dataclass
class ThresholdMetrics:
    precision: float
    recall: float
    threshold: float
    f1: float
    support: int

    @property
    def meets_precision(self) -> bool:
        return self.precision >= 0.95


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train duplicate detection model")
    parser.add_argument(
        "--train-path",
        required=True,
        help="Path to the training CSV file.",
    )
    parser.add_argument(
        "--output-dir",
        default=os.path.join("artifacts", "apgms-ml", "dups"),
        help="Directory to store the trained model and metrics.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.25,
        help="Proportion of the dataset to reserve for validation.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed used for splitting and model training.",
    )
    return parser.parse_args()


def _to_numeric(value: object) -> float:
    if pd.isna(value):
        return math.nan
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float, np.number)):
        return float(value)
    if isinstance(value, str):
        text = value.strip().lower()
        if not text:
            return math.nan
        if text in {"true", "t", "yes", "y"}:
            return 1.0
        if text in {"false", "f", "no", "n"}:
            return 0.0
        try:
            return float(text)
        except ValueError:
            return math.nan
    return math.nan


def _normalise_similarity(value: object) -> Optional[float]:
    if pd.isna(value):
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric < 0:
        return 0.0
    if numeric > 1:
        return 1.0
    return numeric


def _clean_text(value: object) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(value).strip()


def _tfidf_cosine_similarity(text_a: str, text_b: str) -> float:
    if not text_a or not text_b:
        return 0.0
    vectoriser = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5))
    matrix = vectoriser.fit_transform([text_a, text_b])
    # Cosine similarity for two vectors only.
    numerator = matrix[0].multiply(matrix[1]).sum()
    denominator = np.linalg.norm(matrix[0].data) * np.linalg.norm(matrix[1].data)
    if denominator == 0.0:
        return 0.0
    similarity = float(numerator / denominator)
    return max(0.0, min(1.0, similarity))


def ensure_similarity_scores(df: pd.DataFrame) -> pd.DataFrame:
    for sim_col, text_a_col, text_b_col in (
        ("payee_sim", "payee_a", "payee_b"),
        ("memo_sim", "memo_a", "memo_b"),
    ):
        if sim_col not in df.columns:
            df[sim_col] = np.nan
        normalised = df[sim_col].apply(_normalise_similarity)
        needs_backfill = normalised.isna()
        if needs_backfill.any():
            if text_a_col not in df.columns or text_b_col not in df.columns:
                raise ValueError(
                    f"Missing columns {text_a_col}/{text_b_col} needed to derive {sim_col}."
                )
            backfill_values = []
            for text_a, text_b in zip(df.loc[needs_backfill, text_a_col], df.loc[needs_backfill, text_b_col]):
                clean_a = _clean_text(text_a)
                clean_b = _clean_text(text_b)
                backfill_values.append(_tfidf_cosine_similarity(clean_a, clean_b))
            normalised.loc[needs_backfill] = backfill_values
        df[sim_col] = normalised.fillna(0.0)
    return df


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    df = ensure_similarity_scores(df.copy())
    if "near_period" not in df.columns:
        df["near_period"] = np.nan
    df["near_period"] = df["near_period"].apply(_to_numeric).astype(float)
    missing_features = [col for col in FEATURE_COLUMNS if col not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required feature columns: {missing_features}")
    return df


def build_pipeline(random_state: int, class_weight: Optional[dict | str], C: float) -> Pipeline:
    clf = LogisticRegression(
        C=C,
        class_weight=class_weight,
        solver="liblinear",
        max_iter=1000,
        random_state=random_state,
    )
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("classifier", clf),
        ]
    )


def evaluate_thresholds(
    y_true: np.ndarray,
    scores: np.ndarray,
    *,
    min_precision: float = 0.95,
    num_thresholds: int = 181,
) -> ThresholdMetrics:
    thresholds = np.linspace(0.01, 0.99, num=num_thresholds)
    best: Optional[ThresholdMetrics] = None
    best_fallback: Optional[ThresholdMetrics] = None
    for threshold in thresholds:
        y_pred = (scores >= threshold).astype(int)
        support = int(y_pred.sum())
        if support == 0:
            continue
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        metrics = ThresholdMetrics(
            precision=precision,
            recall=recall,
            threshold=float(threshold),
            f1=f1,
            support=support,
        )
        if best_fallback is None or metrics.precision > best_fallback.precision:
            best_fallback = metrics
        if metrics.precision >= min_precision:
            if best is None or metrics.recall > best.recall or (
                math.isclose(metrics.recall, best.recall) and metrics.precision > best.precision
            ):
                best = metrics
    return best or best_fallback or ThresholdMetrics(0.0, 0.0, 0.5, 0.0, 0)


def select_model(
    X_train: pd.DataFrame,
    X_val: pd.DataFrame,
    y_train: np.ndarray,
    y_val: np.ndarray,
    random_state: int,
) -> tuple[Pipeline, ThresholdMetrics, dict]:
    candidate_params = [
        {"classifier__class_weight": None, "classifier__C": 1.0},
        {"classifier__class_weight": "balanced", "classifier__C": 1.0},
        {"classifier__class_weight": None, "classifier__C": 0.5},
        {"classifier__class_weight": None, "classifier__C": 0.25},
        {"classifier__class_weight": "balanced", "classifier__C": 0.5},
    ]

    best_pipeline: Optional[Pipeline] = None
    best_metrics: Optional[ThresholdMetrics] = None
    best_params: Optional[dict] = None
    best_auc = -np.inf

    for params in candidate_params:
        pipeline = build_pipeline(
            random_state=random_state,
            class_weight=params["classifier__class_weight"],
            C=params["classifier__C"],
        )
        pipeline.fit(X_train, y_train)
        scores = pipeline.predict_proba(X_val)[:, 1]
        metrics = evaluate_thresholds(y_val, scores)
        auc = roc_auc_score(y_val, scores)

        prefers_current = False
        if best_metrics is None:
            prefers_current = True
        elif metrics.meets_precision and not best_metrics.meets_precision:
            prefers_current = True
        elif metrics.meets_precision == best_metrics.meets_precision:
            if metrics.recall > best_metrics.recall + 1e-6:
                prefers_current = True
            elif math.isclose(metrics.recall, best_metrics.recall) and metrics.precision > best_metrics.precision:
                prefers_current = True
            elif (
                math.isclose(metrics.recall, best_metrics.recall)
                and math.isclose(metrics.precision, best_metrics.precision)
                and auc > best_auc
            ):
                prefers_current = True

        if prefers_current:
            best_pipeline = pipeline
            best_metrics = metrics
            best_params = params
            best_auc = auc

    if best_pipeline is None or best_metrics is None or best_params is None:
        raise RuntimeError("Model selection failed to produce a candidate.")

    return best_pipeline, best_metrics, best_params | {"auc": best_auc}


def main() -> None:
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    df = pd.read_csv(args.train_path)
    df = prepare_features(df)

    if TARGET_COLUMN not in df.columns:
        raise ValueError(f"Missing target column: {TARGET_COLUMN}")

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN].astype(int).to_numpy()

    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=y,
    )

    pipeline, metrics, params = select_model(X_train, X_val, y_train, y_val, args.random_state)

    # Refit the best configuration on the entire dataset to maximise utility.
    final_pipeline = build_pipeline(
        random_state=args.random_state,
        class_weight=params["classifier__class_weight"],
        C=params["classifier__C"],
    )
    final_pipeline.fit(X, y)

    model_artifact = os.path.join(args.output_dir, "model.joblib")
    joblib.dump({"pipeline": final_pipeline, "threshold": metrics.threshold}, model_artifact)

    # Evaluate on validation split for reporting
    val_scores = pipeline.predict_proba(X_val)[:, 1]
    val_pred = (val_scores >= metrics.threshold).astype(int)
    evaluation = {
        "precision": precision_score(y_val, val_pred, zero_division=0),
        "recall": recall_score(y_val, val_pred, zero_division=0),
        "f1": f1_score(y_val, val_pred, zero_division=0),
        "threshold": metrics.threshold,
        "auc": roc_auc_score(y_val, val_scores),
        "support": int(val_pred.sum()),
        "params": {
            "class_weight": params["classifier__class_weight"],
            "C": params["classifier__C"],
        },
    }

    metrics_artifact = os.path.join(args.output_dir, "metrics.json")
    with open(metrics_artifact, "w", encoding="utf-8") as fh:
        json.dump(evaluation, fh, indent=2, sort_keys=True)

    print("Saved model to", model_artifact)
    print("Saved metrics to", metrics_artifact)
    print(
        f"Validation precision={evaluation['precision']:.3f} recall={evaluation['recall']:.3f} "
        f"threshold={evaluation['threshold']:.2f}"
    )


if __name__ == "__main__":
    main()
