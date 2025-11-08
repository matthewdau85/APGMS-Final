"""Evaluation script to validate trained payroll anomaly models."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, roc_auc_score

from .feature_engineering import FeatureConfig, select_feature_columns


class EvaluationError(RuntimeError):
    """Raised when evaluation fails."""


def evaluate(model_path: Path, dataset_path: Path, feature_config: FeatureConfig, target_column: str) -> dict:
    if not model_path.exists():
        raise EvaluationError(f"Model not found at {model_path}")
    if not dataset_path.exists():
        raise EvaluationError(f"Dataset not found at {dataset_path}")

    pipeline = joblib.load(model_path)
    df = pd.read_csv(dataset_path)
    features = select_feature_columns(df, feature_config)
    y_true = df[target_column]
    y_pred = pipeline.predict(features)
    y_proba = pipeline.predict_proba(features)[:, 1] if hasattr(pipeline.named_steps["model"], "predict_proba") else None

    metrics = classification_report(y_true, y_pred, output_dict=True)
    if y_proba is not None and len(np.unique(y_true)) > 1:
        metrics["roc_auc"] = roc_auc_score(y_true, y_proba)

    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate payroll anomaly detection model")
    parser.add_argument("--model", default="ml/artifacts/model.joblib", type=Path)
    parser.add_argument("--dataset", default="ml/data/curated_payroll_anomalies.csv", type=Path)
    parser.add_argument("--target", default="anomaly_flag")
    parser.add_argument("--datetime", nargs="*", default=["pay_period_start", "pay_period_end"], dest="datetime_columns")
    parser.add_argument("--categorical", nargs="*", default=["org_id", "employee_id", "employment_type"], dest="categorical_columns")
    parser.add_argument("--numerical", nargs="*", default=["gross_pay", "payg_withheld", "super_accrued"], dest="numerical_columns")
    parser.add_argument("--output", default="ml/artifacts/evaluation.json", type=Path)
    args = parser.parse_args()

    feature_config = FeatureConfig(
        datetime_columns=args.datetime_columns,
        categorical_columns=args.categorical_columns,
        numerical_columns=args.numerical_columns,
    )

    metrics = evaluate(args.model, args.dataset, feature_config, args.target)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)
        fh.write("\n")

    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
