from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, MutableMapping, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[3]
MODEL_DIR = REPO_ROOT / "artifacts" / "models"


class ShortfallRiskRequest(BaseModel):
    org_id: str = Field(..., alias="orgId")
    cash_on_hand: float = Field(..., ge=0, alias="cashOnHand")
    upcoming_obligations: float = Field(..., ge=0, alias="upcomingObligations")
    open_high_alerts: int = Field(..., ge=0, alias="openHighAlerts")
    lodgment_completion_ratio: float = Field(..., ge=0, le=1, alias="lodgmentCompletionRatio")
    volatility_index: float = Field(..., ge=0, alias="volatilityIndex")


class FraudRiskRequest(BaseModel):
    org_id: str = Field(..., alias="orgId")
    amount: float = Field(..., gt=0)
    rolling_average_amount: float = Field(..., ge=0, alias="rollingAverageAmount")
    same_day_count: int = Field(..., ge=0, alias="sameDayCount")
    payee_concentration: float = Field(..., ge=0, alias="payeeConcentration")
    recent_velocity: int = Field(..., ge=0, alias="recentVelocity")


class RiskFactor(BaseModel):
    factor: str
    weight: float
    contribution: float
    detail: str


class RiskResponse(BaseModel):
    org_id: str = Field(..., alias="orgId")
    score: float
    risk_level: str = Field(..., alias="riskLevel")
    recommended_action: str = Field(..., alias="recommendedAction")
    explanations: List[str]
    factors: List[RiskFactor]


@dataclass(frozen=True)
class LinearModel:
    bias: float
    weights: Mapping[str, float]
    thresholds: Mapping[str, float]
    actions: Mapping[str, str]
    factors: Mapping[str, str]

    def score(self, features: Mapping[str, float]) -> float:
        activation = self.bias
        for key, weight in self.weights.items():
            activation += weight * features.get(key, 0.0)
        return 1.0 / (1.0 + math.exp(-activation))

    def classify(self, score: float) -> str:
        high = self.thresholds.get("high", 0.8)
        medium = self.thresholds.get("medium", 0.5)
        if score >= high:
            return "high"
        if score >= medium:
            return "medium"
        return "low"

    def action_for(self, level: str) -> str:
        return self.actions.get(level, self.actions.get("low", ""))

    def describe(self, features: Mapping[str, float]) -> List[RiskFactor]:
        items: List[RiskFactor] = []
        for key, weight in self.weights.items():
            contribution = weight * features.get(key, 0.0)
            detail = self.factors.get(key, key)
            items.append(
                RiskFactor(
                    factor=key,
                    weight=weight,
                    contribution=contribution,
                    detail=detail,
                )
            )
        items.sort(key=lambda item: abs(item.contribution), reverse=True)
        return items


def _load_model_file(name: str) -> Mapping[str, object]:
    path = MODEL_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"model {name} not found under {MODEL_DIR}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _build_linear_model(name: str) -> LinearModel:
    raw = _load_model_file(name)
    return LinearModel(
        bias=float(raw["bias"]),
        weights={key: float(value) for key, value in (raw.get("weights") or {}).items()},
        thresholds={key: float(value) for key, value in (raw.get("thresholds") or {}).items()},
        actions={key: str(value) for key, value in (raw.get("actions") or {}).items()},
        factors={key: str(value) for key, value in (raw.get("factors") or {}).items()},
    )


@lru_cache(maxsize=1)
def _shortfall_model() -> LinearModel:
    return _build_linear_model("shortfall_model.json")


@lru_cache(maxsize=1)
def _fraud_model() -> LinearModel:
    return _build_linear_model("fraud_model.json")


def _normalise_features(features: MutableMapping[str, float]) -> None:
    for key, value in list(features.items()):
        if math.isnan(value) or math.isinf(value):
            features[key] = 0.0
        else:
            features[key] = float(value)


def _respond(model: LinearModel, payload: BaseModel, features: Mapping[str, float]) -> RiskResponse:
    _normalise_features(features := dict(features))
    score = model.score(features)
    level = model.classify(score)
    factors = model.describe(features)
    explanations = [factor.detail for factor in factors[:3]]
    return RiskResponse(
        orgId=payload.org_id,
        score=round(score, 4),
        riskLevel=level,
        recommendedAction=model.action_for(level),
        explanations=explanations,
        factors=factors,
    )


def _shortfall_features(body: ShortfallRiskRequest) -> Mapping[str, float]:
    obligations = max(body.upcoming_obligations, 0.0)
    liquidity_gap = (obligations - body.cash_on_hand) / (obligations + 1.0)
    lodgment_gap = 1.0 - min(body.lodgment_completion_ratio, 1.0)
    volatility = min(body.volatility_index, 3.0)
    return {
        "liquidity_gap": max(liquidity_gap, 0.0),
        "open_alerts": float(body.open_high_alerts) / 5.0,
        "lodgment_gap": max(lodgment_gap, 0.0),
        "volatility": volatility,
    }


def _fraud_features(body: FraudRiskRequest) -> Mapping[str, float]:
    avg = max(body.rolling_average_amount, 1.0)
    amount_zscore = (body.amount - avg) / avg
    return {
        "amount_zscore": max(amount_zscore, 0.0),
        "same_day_velocity": float(body.same_day_count) / 5.0,
        "payee_concentration": min(body.payee_concentration, 1.0),
        "recent_velocity": float(body.recent_velocity) / 10.0,
    }


app = FastAPI(title="APGMS ML Service", version="1.0.0")


@app.get("/health")
def healthcheck() -> Mapping[str, object]:
    return {"ok": True, "models": ["shortfall", "fraud"]}


@app.post("/risk/shortfall", response_model=RiskResponse)
def shortfall_risk(body: ShortfallRiskRequest) -> RiskResponse:
    try:
        features = _shortfall_features(body)
        return _respond(_shortfall_model(), body, features)
    except FileNotFoundError as err:
        raise HTTPException(status_code=500, detail=str(err)) from err


@app.post("/risk/fraud", response_model=RiskResponse)
def fraud_risk(body: FraudRiskRequest) -> RiskResponse:
    try:
        features = _fraud_features(body)
        return _respond(_fraud_model(), body, features)
    except FileNotFoundError as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
