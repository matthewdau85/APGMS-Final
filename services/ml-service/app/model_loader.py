
from __future__ import annotations

import json
from dataclasses import dataclass
from math import exp
from pathlib import Path
from typing import Dict, Iterable, List, Sequence


@dataclass(slots=True)
class FeatureWeight:
    name: str
    weight: float
    rationale: str
    mitigation: str


@dataclass(slots=True)
class LinearModelConfig:
    name: str
    bias: float
    threshold: float
    features: Sequence[FeatureWeight]


@dataclass(slots=True)
class FeatureContribution:
    name: str
    value: float
    weight: float
    impact: float
    rationale: str
    mitigation: str


@dataclass(slots=True)
class RiskResult:
    score: float
    threshold: float
    contributions: List[FeatureContribution]

    @property
    def exceeds_threshold(self) -> bool:
        return self.score >= self.threshold

    @property
    def risk_level(self) -> str:
        if self.score >= self.threshold:
            return "high"
        if self.score >= self.threshold * 0.75:
            return "medium"
        return "low"

    def mitigation_steps(self) -> List[str]:
        mitigations: List[str] = []
        for contribution in sorted(
            self.contributions,
            key=lambda item: abs(item.impact),
            reverse=True,
        ):
            if contribution.impact <= 0:
                continue
            if contribution.mitigation not in mitigations:
                mitigations.append(contribution.mitigation)
        return mitigations


class LinearRiskModel:
    def __init__(self, config: LinearModelConfig) -> None:
        self.config = config

    @classmethod
    def from_path(cls, path: Path) -> "LinearRiskModel":
        with path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
        features = [
            FeatureWeight(
                name=feature["name"],
                weight=float(feature["weight"]),
                rationale=feature["rationale"],
                mitigation=feature["mitigation"],
            )
            for feature in raw["features"]
        ]
        config = LinearModelConfig(
            name=raw["name"],
            bias=float(raw["bias"]),
            threshold=float(raw["threshold"]),
            features=features,
        )
        return cls(config)

    def score(self, inputs: Dict[str, float]) -> RiskResult:
        z = self.config.bias
        contributions: List[FeatureContribution] = []
        for feature in self.config.features:
            value = float(inputs.get(feature.name, 0.0))
            impact = value * feature.weight
            z += impact
            contributions.append(
                FeatureContribution(
                    name=feature.name,
                    value=value,
                    weight=feature.weight,
                    impact=impact,
                    rationale=feature.rationale,
                    mitigation=feature.mitigation,
                )
            )
        score = 1.0 / (1.0 + exp(-z))
        contributions.sort(key=lambda item: abs(item.impact), reverse=True)
        return RiskResult(score=score, threshold=self.config.threshold, contributions=contributions)


class ModelRepository:
    def __init__(self, models: Dict[str, LinearRiskModel]) -> None:
        self._models = models

    @classmethod
    def load_directory(cls, directory: Path) -> "ModelRepository":
        models: Dict[str, LinearRiskModel] = {}
        for path in directory.glob("*.json"):
            model = LinearRiskModel.from_path(path)
            models[model.config.name] = model
        if not models:
            raise RuntimeError(f"No model definitions found in {directory}")
        return cls(models)

    def names(self) -> Iterable[str]:
        return self._models.keys()

    def require(self, name: str) -> LinearRiskModel:
        try:
            return self._models[name]
        except KeyError as exc:  # pragma: no cover - defensive guard
            raise KeyError(f"Model '{name}' is not loaded") from exc
