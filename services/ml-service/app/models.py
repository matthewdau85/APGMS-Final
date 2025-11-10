"""Utilities for loading serialized models and running inference."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from math import exp
from pathlib import Path
from typing import Any, Dict, List, Mapping

import json


@dataclass(frozen=True)
class FeatureImpact:
    """Represents the contribution a feature made to the final score."""

    feature: str
    weight: float
    impact: float


@dataclass(frozen=True)
class ModelPrediction:
    """Normalized prediction payload returned to callers."""

    model_version: str
    risk_score: float
    risk_level: str
    recommended_mitigations: List[str]
    explanation: str
    contributing_factors: List[FeatureImpact]


class LinearModel:
    """Simple logistic regression style model backed by JSON weights."""

    def __init__(self, definition: Mapping[str, Any]) -> None:
        self.version = str(definition.get("version", "unknown"))
        self.bias = float(definition.get("bias", 0.0))
        self.weights: Dict[str, float] = {
            str(key): float(value)
            for key, value in (definition.get("weights") or {}).items()
        }
        thresholds = definition.get("thresholds") or {}
        self.threshold_medium = float(thresholds.get("medium", 0.4))
        self.threshold_high = float(thresholds.get("high", 0.7))
        self.mitigations: Dict[str, List[str]] = {
            str(level): list(map(str, value))
            for level, value in (definition.get("mitigations") or {}).items()
        }

    def score(self, features: Mapping[str, float]) -> ModelPrediction:
        raw_score = self.bias
        contributions: List[FeatureImpact] = []
        for feature, weight in self.weights.items():
            value = float(features.get(feature, 0.0))
            contribution = weight * value
            raw_score += contribution
            contributions.append(
                FeatureImpact(feature=feature, weight=weight, impact=contribution)
            )
        probability = 1 / (1 + exp(-raw_score))
        risk_level = self._determine_level(probability)
        mitigations = self.mitigations.get(risk_level, self.mitigations.get("low", []))
        sorted_contributions = sorted(
            contributions,
            key=lambda entry: abs(entry.impact),
            reverse=True,
        )
        top_reasons = [
            f"{item.feature.replace('_', ' ')} contributed {item.impact:+.2f}"
            for item in sorted_contributions[:3]
        ]
        explanation = (
            ", ".join(top_reasons)
            if top_reasons
            else "Model weights did not identify any material drivers."
        )
        return ModelPrediction(
            model_version=self.version,
            risk_score=probability,
            risk_level=risk_level,
            recommended_mitigations=mitigations,
            explanation=explanation,
            contributing_factors=sorted_contributions,
        )

    def _determine_level(self, probability: float) -> str:
        if probability >= self.threshold_high:
            return "high"
        if probability >= self.threshold_medium:
            return "medium"
        return "low"


class RiskModelRepository:
    """Loads serialized model definitions and performs inference."""

    def __init__(self, base_path: Path) -> None:
        self.base_path = base_path
        self._models: Dict[str, LinearModel] = {}

    def load(self) -> None:
        self._models["shortfall"] = self._load_model("shortfall_model.json")
        self._models["fraud"] = self._load_model("fraud_model.json")

    def _load_model(self, filename: str) -> LinearModel:
        path = self.base_path / filename
        if not path.exists():
            raise FileNotFoundError(f"Model artifact {path} was not found")
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return LinearModel(payload)

    def predict(self, model_key: str, features: Mapping[str, float]) -> ModelPrediction:
        if model_key not in self._models:
            raise KeyError(f"Model '{model_key}' is not loaded")
        return self._models[model_key].score(features)


@lru_cache(maxsize=1)
def get_repository(base_path: Path) -> RiskModelRepository:
    repo = RiskModelRepository(base_path)
    repo.load()
    return repo
