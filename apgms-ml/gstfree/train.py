import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler


RANDOM_STATE = 1337
TEXT_COLUMN = "line_desc"
NUMERIC_COLUMNS = ["abn_age_days", "qty", "unit_price", "ship_to_is_au"]
THRESHOLDS = np.arange(0.50, 0.951, 0.01)
N_BOOTSTRAP = 200


def _ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    expected = {
        "invoice_id",
        "line_id",
        "supplier_abn",
        "abn_age_days",
        "line_desc",
        "qty",
        "unit_price",
        "ship_to_country",
        "gst_flag_user",
        "label",
    }
    missing = expected - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    return df


def _prepare_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["label"] = df["label"].astype(int)
    df["ship_to_is_au"] = (
        df["ship_to_country"].fillna("").astype(str).str.upper() == "AU"
    ).astype(int)
    return df


def _build_pipeline() -> Pipeline:
    text_pipeline = Pipeline(
        steps=[
            ("fillna", FunctionTransformer(lambda s: s.fillna(""), validate=False)),
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=2,
                    max_features=30000,
                    lowercase=True,
                    strip_accents="unicode",
                ),
            ),
        ]
    )

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value=0.0)),
            ("log1p", FunctionTransformer(np.log1p, validate=False)),
            ("scaler", StandardScaler()),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("text", text_pipeline, TEXT_COLUMN),
            ("numeric", numeric_pipeline, NUMERIC_COLUMNS),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            (
                "clf",
                LogisticRegression(
                    C=2.0,
                    class_weight="balanced",
                    solver="liblinear",
                    random_state=RANDOM_STATE,
                    max_iter=1000,
                ),
            ),
        ]
    )
    return model


def _split_data(
    X: pd.DataFrame, y: pd.Series
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, pd.Series]:
    X_train, X_temp, y_train, y_temp = train_test_split(
        X,
        y,
        test_size=0.30,
        stratify=y,
        random_state=RANDOM_STATE,
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp,
        y_temp,
        test_size=0.5,
        stratify=y_temp,
        random_state=RANDOM_STATE,
    )
    return X_train, X_val, X_test, y_train, y_val, y_test


def _evaluate_at_threshold(
    y_true: np.ndarray, y_scores: np.ndarray, threshold: float
) -> Dict[str, float]:
    y_pred = (y_scores >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    threshold = float(threshold)
    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    fp_rate = float(fp / (fp + tn)) if (fp + tn) else 0.0
    fn_rate = float(fn / (fn + tp)) if (fn + tp) else 0.0
    return {
        "threshold": threshold,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "tp": int(tp),
        "fp_rate": fp_rate,
        "fn_rate": fn_rate,
    }


def _bootstrap_ci(
    y_true: np.ndarray, y_scores: np.ndarray, threshold: float
) -> Dict[str, Tuple[float, float]]:
    rng = np.random.default_rng(RANDOM_STATE)
    n = len(y_true)
    prec_samples = []
    rec_samples = []
    for _ in range(N_BOOTSTRAP):
        idx = rng.integers(0, n, size=n)
        sample_true = y_true[idx]
        sample_scores = y_scores[idx]
        sample_pred = (sample_scores >= threshold).astype(int)
        prec_samples.append(
            precision_score(sample_true, sample_pred, zero_division=0)
        )
        rec_samples.append(
            recall_score(sample_true, sample_pred, zero_division=0)
        )
    precision_ci = (
        float(np.percentile(prec_samples, 2.5)),
        float(np.percentile(prec_samples, 97.5)),
    )
    recall_ci = (
        float(np.percentile(rec_samples, 2.5)),
        float(np.percentile(rec_samples, 97.5)),
    )
    return {"precision": precision_ci, "recall": recall_ci}


def _select_threshold(
    y_true: np.ndarray, y_scores: np.ndarray
) -> Dict[str, float]:
    best_result = None
    for threshold in THRESHOLDS:
        metrics = _evaluate_at_threshold(y_true, y_scores, threshold)
        if metrics["fp_rate"] > 0.01 or metrics["fn_rate"] > 0.05:
            continue
        if best_result is None or metrics["f1"] > best_result["f1"]:
            best_result = metrics
        elif best_result is not None and metrics["f1"] == best_result["f1"]:
            if threshold > best_result["threshold"]:
                best_result = metrics
    if best_result is None:
        raise RuntimeError("No threshold satisfied the fp/fn constraints.")
    return best_result


def _compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def train_model(data_path: Path, out_path: Path, metrics_path: Path) -> None:
    df = pd.read_csv(data_path)
    df = _ensure_columns(df)
    df = _prepare_frame(df)

    X = df[[TEXT_COLUMN] + NUMERIC_COLUMNS]
    y = df["label"]

    X_train, X_val, X_test, y_train, y_val, y_test = _split_data(X, y)

    model = _build_pipeline()
    model.fit(X_train, y_train)

    val_scores = model.predict_proba(X_val)[:, 1]
    test_scores = model.predict_proba(X_test)[:, 1]

    selected = _select_threshold(y_val.to_numpy(), val_scores)
    threshold = float(selected["threshold"])

    roc_auc = float(roc_auc_score(y_test, test_scores))
    pr_auc = float(average_precision_score(y_test, test_scores))

    val_metrics_by_threshold = {
        f"{thr:.2f}": _evaluate_at_threshold(y_val, val_scores, thr)
        for thr in THRESHOLDS
    }

    test_metrics = _evaluate_at_threshold(y_test, test_scores, threshold)
    bootstrap_ci = _bootstrap_ci(y_test.to_numpy(), test_scores, threshold)

    metrics_payload = {
        "threshold": threshold,
        "validation_selected": selected,
        "validation": val_metrics_by_threshold,
        "test": {
            "roc_auc": roc_auc,
            "pr_auc": pr_auc,
            "precision": test_metrics["precision"],
            "recall": test_metrics["recall"],
            "f1": test_metrics["f1"],
            "confusion_matrix": {
                "tn": test_metrics["tn"],
                "fp": test_metrics["fp"],
                "fn": test_metrics["fn"],
                "tp": test_metrics["tp"],
            },
            "fp_rate": test_metrics["fp_rate"],
            "fn_rate": test_metrics["fn_rate"],
            "precision_ci": bootstrap_ci["precision"],
            "recall_ci": bootstrap_ci["recall"],
        },
    }

    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    dataset_sha = _compute_sha256(data_path)
    meta = {
        "model": "gstfree",
        "threshold": threshold,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "sha256": dataset_sha,
    }
    payload = {"pipeline": model, "meta": meta}

    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, out_path)


def parse_args(args: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train GST-free classifier")
    parser.add_argument("--data", required=True, type=Path, help="Path to dataset CSV")
    parser.add_argument("--out", required=True, type=Path, help="Output path for model")
    parser.add_argument(
        "--metrics",
        type=Path,
        default=Path("metrics.json"),
        help="Output path for metrics JSON",
    )
    return parser.parse_args(args)


def main(argv: Iterable[str] = None) -> None:
    args = parse_args(argv or sys.argv[1:])
    train_model(args.data, args.out, args.metrics)


if __name__ == "__main__":
    main()
