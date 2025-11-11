from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable
import json
import datetime as dt

import numpy as np
import pandas as pd
import shap


def generate_shap_summary(
    pipeline: Any,
    features: pd.DataFrame,
    output_dir: Path | None = None,
) -> Path:
    """Generate a SHAP summary for the fitted pipeline."""

    output_dir = output_dir or (Path(__file__).resolve().parents[4] / "docs" / "ml" / "reports")
    output_dir.mkdir(parents=True, exist_ok=True)
    shap_path = output_dir / "shap_summary.json"

    if pipeline is None or features.empty:
        shap_path.write_text(json.dumps({"message": "No features available for SHAP analysis."}, indent=2), encoding="utf8")
        return shap_path

    preprocess = getattr(pipeline, "named_steps", {}).get("preprocess")
    model = getattr(pipeline, "named_steps", {}).get("model", pipeline)

    transformed = preprocess.transform(features) if preprocess else features

    explainer = shap.Explainer(model, transformed)
    shap_values = explainer(transformed)
    mean_abs = np.mean(np.abs(shap_values.values), axis=0)

    feature_names = None
    if preprocess and hasattr(preprocess, "get_feature_names_out"):
        feature_names = list(preprocess.get_feature_names_out())
    elif hasattr(model, "feature_names_in_"):
        feature_names = list(getattr(model, "feature_names_in_"))
    else:
        feature_names = [f"feature_{idx}" for idx in range(len(mean_abs))]

    summary = [
        {"feature": feature, "mean_abs_shap": float(value)}
        for feature, value in zip(feature_names, mean_abs)
    ]

    shap_path.write_text(json.dumps(summary, indent=2), encoding="utf8")
    return shap_path


def _compute_group_fairness(
    labels: pd.Series,
    predictions: Iterable,
    sensitive_feature: pd.Series,
) -> Dict[str, float]:
    """Compute simple demographic parity deltas by sensitive feature."""

    predictions_series = pd.Series(predictions, index=labels.index)
    positive_label = None
    if labels.dtype == "O":
        positive_label = labels.mode().iloc[0] if not labels.mode().empty else None
    else:
        positive_label = labels.max()

    overall_rate = float(np.mean(predictions_series == positive_label)) if positive_label is not None else 0.0

    fairness: Dict[str, float] = {}
    sensitive_series = sensitive_feature.astype("string")
    for group, idx in sensitive_series.groupby(sensitive_series).groups.items():
        group_preds = predictions_series.loc[idx]
        rate = float(np.mean(group_preds == positive_label)) if positive_label is not None else 0.0
        fairness[str(group)] = rate - overall_rate

    return fairness


def generate_model_report(
    pipeline: Any,
    dataset: pd.DataFrame,
    sensitive_column: str = "orgId",
    output_dir: Path | None = None,
) -> Path:
    """Generate a Markdown report summarising fairness and explainability."""

    output_dir = output_dir or (Path(__file__).resolve().parents[4] / "docs" / "ml" / "reports")
    output_dir.mkdir(parents=True, exist_ok=True)

    report_path = output_dir / f"compliance-model-report-{dt.datetime.utcnow().strftime('%Y%m%d%H%M%S')}.md"

    if pipeline is None or dataset.empty:
        content = """# Compliance ML Report

_No trained pipeline or dataset available._

This placeholder exists so auditors can trace that the reporting job executed even when
no training data was present. Policy linkage: see `docs/compliance/dsp-operational-framework.md` and
`docs/dsp-osf/evidence-index.md`.
"""
        report_path.write_text(content, encoding="utf8")
        return report_path

    if sensitive_column not in dataset.columns:
        dataset = dataset.assign(**{sensitive_column: "unknown"})

    features = dataset.drop(columns=[col for col in ["label"] if col in dataset.columns])
    labels = dataset["label"] if "label" in dataset.columns else pd.Series(dtype=float, index=dataset.index)
    predictions = pipeline.predict(features)

    fairness = _compute_group_fairness(labels, predictions, dataset[sensitive_column])
    shap_summary_path = generate_shap_summary(pipeline, features, output_dir)

    content = [
        "# Compliance ML Report",
        "",
        f"Generated: {dt.datetime.utcnow().isoformat()}Z",
        "",
        "## Fairness analysis",
        "",
    ]

    if fairness:
        for group, delta in fairness.items():
            content.append(f"- **{group}** demographic parity delta: {delta:.4f}")
    else:
        content.append("- No fairness metrics available.")

    content.extend(
        [
            "",
            "## Explainability",
            "",
            f"SHAP feature summary saved to `{shap_summary_path}`.",
            "",
            "## Policy alignment",
            "",
            "- DSP Operational Framework: `docs/compliance/dsp-operational-framework.md`",
            "- Evidence register: `docs/dsp-osf/evidence-index.md`",
        ]
    )

    report_path.write_text("\n".join(content), encoding="utf8")
    return report_path
