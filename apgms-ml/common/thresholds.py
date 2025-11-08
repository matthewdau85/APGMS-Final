"""Central registry for model evaluation thresholds."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Mapping


@dataclass(frozen=True)
class ModelThresholds:
    """Capture the minimum metrics required for promotion."""

    metric_floor: Mapping[str, float]
    default_threshold: float


MODEL_THRESHOLDS: Dict[str, ModelThresholds] = {
    "gstfree": ModelThresholds(metric_floor={"roc_auc": 0.60, "accuracy": 0.55}, default_threshold=0.50),
    "bas_conf": ModelThresholds(metric_floor={"roc_auc": 0.55, "f1": 0.50}, default_threshold=0.45),
    "paygw_var": ModelThresholds(metric_floor={"r2": 0.60}, default_threshold=0.0),
    "dups": ModelThresholds(metric_floor={"roc_auc": 0.70, "precision": 0.65}, default_threshold=0.60),
    "apportion": ModelThresholds(metric_floor={"r2": 0.55}, default_threshold=0.0),
}


def get_thresholds(model_name: str) -> ModelThresholds:
    """Return the configured thresholds for *model_name*."""
    try:
        return MODEL_THRESHOLDS[model_name]
    except KeyError as exc:  # pragma: no cover - defensive
        raise ValueError(f"No thresholds configured for '{model_name}'") from exc
