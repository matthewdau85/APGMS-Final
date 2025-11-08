"""Training entrypoint for PAYGW variance classification model.

This script trains a LightGBM multi-class classifier to predict label_status
values (``ok``, ``warn`` or ``block``) for PAYGW variance records.  The
resulting model is persisted to ``model.joblib`` together with relevant
metadata and an accompanying ``metrics.json`` file capturing evaluation
statistics and gate status.

Expected CSV schema
-------------------
The input training file must contain the following columns::

    period,gross_pay,tax_withheld,super,headcount,prior3_mean_tax,
    seasonality_ix,actual_tax,label_status

The ``label_status`` column must contain one of ``ok``, ``warn`` or ``block``.
All other columns are numerical besides ``period`` which is parsed as a
``datetime`` and expanded into ``period_year`` and ``period_month`` features.

Usage
-----
    python -m apgms_ml.paygw_var.train --input data.csv --output-dir artifacts/

The command produces ``model.joblib`` and ``metrics.json`` under
``--output-dir``.  The process exits with a non-zero status code whenever the
quality gates are not met.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Tuple

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.metrics import classification_report, precision_recall_fscore_support
from sklearn.model_selection import train_test_split

LABEL_MAP: Dict[str, int] = {"ok": 0, "warn": 1, "block": 2}
REVERSE_LABEL_MAP: Dict[int, str] = {v: k for k, v in LABEL_MAP.items()}
BLOCK_LABEL_ID = LABEL_MAP["block"]


def _validate_columns(columns: Iterable[str]) -> None:
    required = {
        "period",
        "gross_pay",
        "tax_withheld",
        "super",
        "headcount",
        "prior3_mean_tax",
        "seasonality_ix",
        "actual_tax",
        "label_status",
    }
    missing = required.difference(columns)
    if missing:
        raise ValueError(f"Training data missing required columns: {sorted(missing)}")


def _prepare_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, pd.Series]:
    """Prepare the feature matrix and target vector.

    Returns the processed features, encoded labels, and the ``actual_tax`` column which is
    retained for the evaluation gates.
    """

    df = df.copy()

    # Ensure label encoding is available before mutating the column.
    if not set(df["label_status"].unique()).issubset(LABEL_MAP):
        unknown = sorted(set(df["label_status"]) - set(LABEL_MAP))
        raise ValueError(f"Unknown label_status values encountered: {unknown}")

    df["label"] = df["label_status"].map(LABEL_MAP)

    # Parse the period into explicit numerical components to avoid leakage from raw strings.
    df["period"] = pd.to_datetime(df["period"], errors="coerce")
    if df["period"].isna().any():
        raise ValueError("Unable to parse 'period' values into datetime objects")
    df["period_year"] = df["period"].dt.year
    df["period_month"] = df["period"].dt.month
    df = df.drop(columns=["period", "label_status"])

    actual_tax = df["actual_tax"].copy()
    df = df.drop(columns=["actual_tax"])

    feature_columns = [c for c in df.columns if c != "label"]
    features = df[feature_columns].fillna(df[feature_columns].median())
    labels = df["label"].astype(int)
    return features, labels, actual_tax


@dataclass
class PersistedModel:
    model: LGBMClassifier
    feature_names: Tuple[str, ...]
    label_map: Dict[str, int]


def _train_model(features: pd.DataFrame, labels: pd.Series) -> Tuple[LGBMClassifier, pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
    X_train, X_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    model = LGBMClassifier(
        objective="multiclass",
        num_class=len(LABEL_MAP),
        class_weight="balanced",
        learning_rate=0.05,
        n_estimators=500,
        max_depth=-1,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        eval_metric="multi_logloss",
        verbose=False,
    )
    return model, X_train, y_train, X_test, y_test


def _compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    label_names: Dict[int, str],
) -> Dict[str, Dict[str, float]]:
    report = classification_report(
        y_true,
        y_pred,
        target_names=[label_names[i] for i in sorted(label_names)],
        output_dict=True,
        zero_division=0,
    )

    precision_micro, recall_micro, f1_micro, _ = precision_recall_fscore_support(
        y_true,
        y_pred,
        average="micro",
        zero_division=0,
    )

    # Rename keys to their textual labels for readability.
    metrics: Dict[str, Dict[str, float]] = {}
    for key, value in report.items():
        if key in label_names.values():
            metrics[key] = {
                "precision": float(value.get("precision", 0.0)),
                "recall": float(value.get("recall", 0.0)),
                "f1": float(value.get("f1-score", 0.0)),
                "support": int(value.get("support", 0)),
            }
        else:
            metrics[key] = {k: float(v) for k, v in value.items() if isinstance(v, (int, float))}

    metrics["micro avg"] = {
        "precision": float(precision_micro),
        "recall": float(recall_micro),
        "f1": float(f1_micro),
    }
    return metrics


def _evaluate_gates(
    metrics: Dict[str, Dict[str, float]],
    actual_block_mask: np.ndarray,
    y_pred: np.ndarray,
) -> Dict[str, Dict[str, float]]:
    block_metrics = metrics.get("block", {})
    block_precision = block_metrics.get("precision", 0.0)

    # Recall for block is evaluated on material differences where the absolute variance exceeds 1000.
    material_mask = actual_block_mask
    if material_mask.sum() > 0:
        material_recall = float(np.mean(y_pred[material_mask] == BLOCK_LABEL_ID))
    else:
        material_recall = 1.0  # No material cases to measure against.

    gates = {
        "block_precision": {
            "threshold": 0.90,
            "value": block_precision,
            "passed": block_precision >= 0.90,
        },
        "block_material_recall": {
            "threshold": 0.60,
            "value": material_recall,
            "passed": material_recall >= 0.60,
        },
    }
    return gates


def run(input_path: Path, output_dir: Path) -> int:
    df = pd.read_csv(input_path)
    _validate_columns(df.columns)

    features, labels, actual_tax = _prepare_features(df)

    model, X_train, y_train, X_test, y_test = _train_model(features, labels)
    y_pred = model.predict(X_test)

    metrics = _compute_metrics(y_test.to_numpy(), y_pred, REVERSE_LABEL_MAP)

    # Material difference mask is computed over the held-out test split: block rows where the
    # absolute difference between actual tax and withheld tax exceeds $1,000.
    withheld_test = df.loc[y_test.index, "tax_withheld"].to_numpy()
    actual_tax_test = actual_tax.loc[y_test.index].to_numpy()
    actual_block_mask = (y_test.to_numpy() == BLOCK_LABEL_ID) & (np.abs(actual_tax_test - withheld_test) > 1000)

    gates = _evaluate_gates(metrics, actual_block_mask, y_pred)

    persisted = PersistedModel(
        model=model,
        feature_names=tuple(X_train.columns),
        label_map=LABEL_MAP,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(persisted, output_dir / "model.joblib")

    metrics_payload = {
        "metrics": metrics,
        "gates": gates,
    }
    (output_dir / "metrics.json").write_text(json.dumps(metrics_payload, indent=2))

    failed_gates = [name for name, info in gates.items() if not info.get("passed", False)]
    if failed_gates:
        sys.stderr.write(
            "\n" + "\n".join(
                f"Gate '{name}' failed: value={metrics_payload['gates'][name]['value']:.3f} "
                f"< threshold={metrics_payload['gates'][name]['threshold']:.2f}"
                for name in failed_gates
            )
            + "\n"
        )
        return 1

    return 0


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train PAYGW variance classification model")
    parser.add_argument("--input", type=Path, required=True, help="Path to the training CSV file")
    parser.add_argument("--output-dir", type=Path, required=True, help="Directory to write artifacts to")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        return run(args.input, args.output_dir)
    except Exception as exc:  # pragma: no cover - surface the error message to the CLI.
        sys.stderr.write(f"Training failed: {exc}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
