"""Responsible AI reporting utilities for compliance datasets."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Tuple

import mlflow
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

GOVERNANCE_REFERENCES = [
    {
        "control": "dsp.logging_evidence",
        "title": "DSP Operational Framework – Logging & evidence",
        "href": "../compliance/dsp-operational-framework.md#logging--evidence",
    },
    {
        "control": "dsp.security_incident_response",
        "title": "DSP Operational Framework – Security posture & incident response",
        "href": "../compliance/dsp-operational-framework.md#security-posture--incident-response",
    },
]

DEFAULT_REPORT_DIR = Path("docs/ml/reports")


def generate_reports(dataset_path: str | Path, output_dir: str | Path | None = None) -> Dict[str, Path]:
    """Generate fairness, bias, and SHAP explainability artefacts for a dataset."""
    dataset_path = Path(dataset_path)
    if output_dir is None:
        output_dir = DEFAULT_REPORT_DIR
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    df = _load_dataset(dataset_path)
    feature_frame, target, feature_names, sensitive_col = _prepare_frame(df)

    model, metrics = _train_model(feature_frame, target)
    fairness = _compute_fairness(df, metrics["predictions"], sensitive_col)
    shap_summary = _compute_shap_summary(model, feature_frame, feature_names)

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    metrics_path = output_dir / f"metrics_{timestamp}.json"
    shap_path = output_dir / f"shap_{timestamp}.json"
    report_path = output_dir / f"report_{timestamp}.md"

    metrics_payload = {
        "classification_report": metrics["report"],
        "roc_auc": metrics["roc_auc"],
        "fairness": fairness,
        "sensitive_column": sensitive_col,
        "governance": GOVERNANCE_REFERENCES,
    }
    metrics_path.write_text(json.dumps(metrics_payload, indent=2), encoding="utf-8")
    shap_path.write_text(json.dumps(shap_summary, indent=2), encoding="utf-8")
    report_path.write_text(
        _render_markdown_report(metrics_payload, shap_summary, dataset_path),
        encoding="utf-8",
    )

    _log_to_mlflow(metrics_path, shap_path, report_path)

    return {
        "metrics": metrics_path,
        "shap": shap_path,
        "report": report_path,
    }


def _load_dataset(path: Path) -> pd.DataFrame:
    if path.suffix == ".parquet":
        try:
            return pd.read_parquet(path)
        except (ImportError, ValueError):
            return pd.read_csv(path.with_suffix(".csv"))
    return pd.read_csv(path)


def _prepare_frame(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, Iterable[str], str | None]:
    df = df.copy()
    label = df.get("label")
    if label is None:
        raise ValueError("Dataset must contain a 'label' column")

    target = (label.astype(str).str.lower() == "requires_review").astype(int)

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    non_feature_cols = {"discrepancy_id", "org_id", "payment_plan_amount_cents"}
    feature_cols = [col for col in numeric_cols if col not in non_feature_cols or col == "payment_plan_amount_cents"]
    if "payment_plan_amount_cents" not in feature_cols and "payment_plan_amount_cents" in numeric_cols:
        feature_cols.append("payment_plan_amount_cents")

    feature_frame = df[feature_cols].fillna(0)

    sensitive_col = None
    for col in df.columns:
        if "sensitive" in col.lower():
            sensitive_col = col
            break

    return feature_frame, target, feature_cols, sensitive_col


def _train_model(features: pd.DataFrame, target: pd.Series):
    X_train, X_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
        stratify=target if target.nunique() > 1 else None,
    )

    model = XGBClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        use_label_encoder=False,
    )
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    predictions = (proba >= 0.5).astype(int)

    report = classification_report(y_test, predictions, output_dict=True)
    roc_auc = roc_auc_score(y_test, proba) if y_test.nunique() > 1 else 0.5

    return model, {
        "report": report,
        "roc_auc": float(roc_auc),
        "predictions": pd.Series(predictions, index=X_test.index),
    }


def _compute_fairness(df: pd.DataFrame, predictions: pd.Series, sensitive_col: str | None) -> Dict[str, Dict[str, float]]:
    if sensitive_col is None or sensitive_col not in df.columns:
        return {}

    fairness: Dict[str, Dict[str, float]] = {}
    positive_mask = df["label"].astype(str).str.lower() == "requires_review"

    for group, group_df in df.groupby(sensitive_col):
        group_mask = group_df.index
        group_predictions = predictions.loc[group_mask] if not predictions.empty else pd.Series(dtype=float)
        fairness[str(group)] = {
            "count": float(len(group_df)),
            "actual_positive_rate": float(positive_mask.loc[group_mask].mean()),
            "predicted_positive_rate": float(group_predictions.mean() if not group_predictions.empty else 0),
        }

    return fairness


def _compute_shap_summary(model: XGBClassifier, features: pd.DataFrame, feature_names: Iterable[str]) -> Dict[str, float]:
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(features)
    if isinstance(shap_values, list):
        shap_values = shap_values[0]
    mean_abs = np.mean(np.abs(shap_values), axis=0)
    return {name: float(value) for name, value in zip(feature_names, mean_abs)}


def _render_markdown_report(metrics: Dict[str, object], shap_summary: Dict[str, float], dataset_path: Path) -> str:
    lines = [
        "# Compliance ML Fairness & Explainability Report",
        "",
        f"_Generated_: {datetime.utcnow().isoformat()}Z",
        f"_Dataset_: `{dataset_path}`",
        "",
        "## Model performance",
        "",
        f"- ROC AUC: **{metrics['roc_auc']:.3f}**",
        "- Weighted F1: **{metrics['classification_report']['weighted avg']['f1-score']:.3f}**",
        "",
        "## Fairness analysis",
        "",
    ]

    fairness = metrics.get("fairness") or {}
    if fairness:
        lines.append("| Group | Actual positive rate | Predicted positive rate |")
        lines.append("| --- | --- | --- |")
        for group, values in fairness.items():
            lines.append(
                f"| {group} | {values['actual_positive_rate']:.3f} | {values['predicted_positive_rate']:.3f} |"
            )
    else:
        lines.append("Sensitive attribute column not present; fairness metrics default to empty baseline.")

    lines.extend([
        "",
        "## SHAP summary",
        "",
    ])
    for feature, score in sorted(shap_summary.items(), key=lambda item: item[1], reverse=True):
        lines.append(f"- **{feature}**: {score:.4f}")

    lines.extend([
        "",
        "## Governance alignment",
        "",
    ])
    for ref in GOVERNANCE_REFERENCES:
        lines.append(f"- [{ref['title']}]({ref['href']}) – control `{ref['control']}`")

    return "\n".join(lines) + "\n"


def _log_to_mlflow(metrics_path: Path, shap_path: Path, report_path: Path) -> None:
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI")
    if not tracking_uri:
        return

    mlflow.set_tracking_uri(tracking_uri)
    with mlflow.start_run(run_name="compliance-fairness-report"):
        mlflow.log_artifact(str(metrics_path), artifact_path="reports")
        mlflow.log_artifact(str(shap_path), artifact_path="reports")
        mlflow.log_artifact(str(report_path), artifact_path="reports")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate fairness, bias, and SHAP reports")
    parser.add_argument("dataset", help="Path to the dataset generated by feature builders")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_REPORT_DIR),
        help="Directory to store generated reports",
    )
    args = parser.parse_args()

    outputs = generate_reports(args.dataset, args.output_dir)
    print(json.dumps({k: str(v) for k, v in outputs.items()}, indent=2))


if __name__ == "__main__":
    main()
