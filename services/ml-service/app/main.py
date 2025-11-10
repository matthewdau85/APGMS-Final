"""FastAPI application exposing ML risk scoring endpoints."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException

from .models import ModelPrediction, get_repository
from .schemas import FraudRequest, RiskResponse, ShortfallRequest

logger = logging.getLogger(__name__)

BASE_PATH = Path(__file__).resolve().parents[3] / "artifacts" / "models"

app = FastAPI(title="APGMS ML Service", version="1.0.0")


@app.on_event("startup")
async def load_models() -> None:
    try:
        get_repository(BASE_PATH)
        logger.info("risk_models_loaded", extra={"base_path": str(BASE_PATH)})
    except FileNotFoundError as exc:  # pragma: no cover - misconfiguration
        logger.exception("risk_model_load_failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _serialize_prediction(prediction: ModelPrediction) -> RiskResponse:
    return RiskResponse(
        modelVersion=prediction.model_version,
        riskScore=prediction.risk_score,
        riskLevel=prediction.risk_level,
        recommendedMitigations=prediction.recommended_mitigations,
        explanation=prediction.explanation,
        contributingFactors=[
            {
                "feature": factor.feature,
                "weight": factor.weight,
                "impact": factor.impact,
            }
            for factor in prediction.contributing_factors
        ],
    )


@app.post("/risk/shortfall", response_model=RiskResponse)
async def score_shortfall(payload: ShortfallRequest) -> RiskResponse:
    repo = get_repository(BASE_PATH)
    prediction = repo.predict(
        "shortfall",
        {
            "liquidityCoverage": payload.liquidity_coverage,
            "escrowCoverage": payload.escrow_coverage,
            "outstandingAlerts": float(payload.outstanding_alerts),
            "basWindowDays": float(payload.bas_window_days),
            "recentShortfalls": float(payload.recent_shortfalls),
        },
    )
    return _serialize_prediction(prediction)


@app.post("/risk/fraud", response_model=RiskResponse)
async def score_fraud(payload: FraudRequest) -> RiskResponse:
    repo = get_repository(BASE_PATH)
    prediction = repo.predict(
        "fraud",
        {
            "amount": payload.amount,
            "channelRisk": payload.channel_risk,
            "velocity": payload.velocity,
            "geoDistance": payload.geo_distance,
            "accountTenureDays": float(payload.account_tenure_days),
            "previousIncidents": float(payload.previous_incidents),
        },
    )
    return _serialize_prediction(prediction)


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "service": "ml-service", "models": list(get_repository(BASE_PATH)._models.keys())}
