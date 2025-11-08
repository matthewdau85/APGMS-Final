import argparse
import json
import sys
from pathlib import Path
from typing import Iterable

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.append(str(CURRENT_DIR))

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from train import (  # type: ignore
    NUMERIC_COLUMNS,
    TEXT_COLUMN,
    _ensure_columns,
    _prepare_frame,
    _split_data,
)


def _load_artifacts(model_path: Path, metrics_path: Path):
    payload = joblib.load(model_path)
    with metrics_path.open("r", encoding="utf-8") as f:
        metrics = json.load(f)
    return payload, metrics


def evaluate(model_path: Path, metrics_path: Path, data_path: Path) -> int:
    payload, stored_metrics = _load_artifacts(model_path, metrics_path)
    pipeline = payload["pipeline"]
    threshold = float(payload["meta"].get("threshold"))
    stored_threshold = float(stored_metrics.get("threshold", threshold))

    df = pd.read_csv(data_path)
    df = _prepare_frame(_ensure_columns(df))

    X = df[[TEXT_COLUMN] + NUMERIC_COLUMNS]
    y = df["label"]

    _, _, X_test, _, _, y_test = _split_data(X, y)

    scores = pipeline.predict_proba(X_test)[:, 1]
    preds = (scores >= threshold).astype(int)

    roc_auc = roc_auc_score(y_test, scores)
    pr_auc = average_precision_score(y_test, scores)
    precision = precision_score(y_test, preds, zero_division=0)
    recall = recall_score(y_test, preds, zero_division=0)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    tn = int(np.sum((preds == 0) & (y_test == 0)))
    fp = int(np.sum((preds == 1) & (y_test == 0)))
    fn = int(np.sum((preds == 0) & (y_test == 1)))
    tp = int(np.sum((preds == 1) & (y_test == 1)))

    fp_rate = fp / (fp + tn) if (fp + tn) else 0.0
    fn_rate = fn / (fn + tp) if (fn + tp) else 0.0

    passed = True
    messages = []

    if roc_auc >= 0.92:
        messages.append(f"ROC AUC: {roc_auc:.4f} (pass)")
    else:
        messages.append(f"ROC AUC: {roc_auc:.4f} (fail < 0.92)")
        passed = False

    if fp_rate <= 0.01:
        messages.append(f"FP rate: {fp_rate:.4f} (pass)")
    else:
        messages.append(f"FP rate: {fp_rate:.4f} (fail > 0.01)")
        passed = False

    if fn_rate <= 0.05:
        messages.append(f"FN rate: {fn_rate:.4f} (pass)")
    else:
        messages.append(f"FN rate: {fn_rate:.4f} (fail > 0.05)")
        passed = False

    messages.append(
        "Precision/Recall/F1: " f"{precision:.4f}/{recall:.4f}/{f1:.4f}"
    )
    messages.append(f"PR AUC: {pr_auc:.4f}")
    if not np.isclose(threshold, stored_threshold, atol=1e-6):
        messages.append(
            f"WARNING: model threshold {threshold:.4f} differs from metrics.json {stored_threshold:.4f}"
        )
    else:
        messages.append(f"Threshold: {threshold:.2f}")

    report = "\n".join(messages)
    print(report)

    return 0 if passed else 1


def parse_args(args: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate GST-free classifier")
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--metrics", required=True, type=Path)
    return parser.parse_args(args)


def main(argv: Iterable[str] = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    return evaluate(args.model, args.metrics, args.data)


if __name__ == "__main__":
    sys.exit(main())
