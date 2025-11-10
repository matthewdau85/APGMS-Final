from __future__ import annotations

from typing import Dict, Iterable, List
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

from .model_loader import ModelRepository, RiskResult
from .schemas import FeatureExplanation, FraudRiskRequest, RiskResponse, ShortfallRiskRequest


inference_total = Counter(
    "ml_service_inference_total",
    "Total number of inference requests processed",
    labelnames=("model", "outcome"),
)
inference_latency = Histogram(
    "ml_service_inference_seconds",
    "Latency for ML inference operations",
    labelnames=("model",),
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0),
)
model_threshold_gauge = Gauge(
    "ml_service_model_threshold",
    "Configured decision threshold for each model",
    labelnames=("model",),
)


def load_repository() -> ModelRepository:
    directory = Path(__file__).resolve().parent.parent / "models"
    repo = ModelRepository.load_directory(directory)
    for name in repo.names():
        threshold = repo.require(name).config.threshold
        model_threshold_gauge.labels(model=name).set(threshold)
    return repo


app = FastAPI(title="APGMS Risk Service", version="0.1.0")


@app.on_event("startup")
def register_models() -> None:
    app.state.repository = load_repository()


def get_repository() -> ModelRepository:
    repo = getattr(app.state, "repository", None)
    if repo is None:  # pragma: no cover - defensive guard
        raise RuntimeError("model repository is not initialised")
    return repo


def build_response(model: str, result: RiskResult) -> RiskResponse:
    top_contributions = result.contributions[:3]
    explanations: List[FeatureExplanation] = [
        FeatureExplanation(
            name=contribution.name,
            value=contribution.value,
            weight=contribution.weight,
            impact=contribution.impact,
            rationale=contribution.rationale,
            mitigation=contribution.mitigation,
        )
        for contribution in top_contributions
    ]
    return RiskResponse(
        model=model,
        score=round(result.score, 6),
        threshold=result.threshold,
        risk_level=result.risk_level,
        exceeds_threshold=result.exceeds_threshold,
        mitigations=result.mitigation_steps(),
        top_explanations=explanations,
    )


@app.get("/health", response_class=JSONResponse)
def health(repo: ModelRepository = Depends(get_repository)) -> Dict[str, Iterable[str]]:
    return {"ok": True, "models": list(repo.names())}


def run_inference(model: str, inputs: Dict[str, float], repo: ModelRepository) -> RiskResponse:
    timer = inference_latency.labels(model=model).time()
    outcome = "success"
    try:
        result = repo.require(model).score(inputs)
        response = build_response(model, result)
        if response.exceeds_threshold:
            outcome = "blocked"
        return response
    except KeyError as exc:  # pragma: no cover - defensive guard
        outcome = "error"
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive guard
        outcome = "error"
        raise HTTPException(status_code=500, detail="inference_failed") from exc
    finally:
        try:
            timer()
        except TypeError:  # pragma: no cover
            pass
        inference_total.labels(model=model, outcome=outcome).inc()


@app.post("/risk/shortfall", response_model=RiskResponse)
def shortfall_risk(
    payload: ShortfallRiskRequest,
    repo: ModelRepository = Depends(get_repository),
) -> RiskResponse:
    inputs = {
        "cash_on_hand": payload.cash_on_hand,
        "monthly_burn": payload.monthly_burn,
        "obligations_due": payload.obligations_due,
        "forecast_revenue": payload.forecast_revenue,
    }
    return run_inference("shortfall", inputs, repo)


@app.post("/risk/fraud", response_model=RiskResponse)
def fraud_risk(
    payload: FraudRiskRequest,
    repo: ModelRepository = Depends(get_repository),
) -> RiskResponse:
    inputs = {
        "transfer_amount": payload.transfer_amount,
        "daily_velocity": payload.daily_velocity,
        "anomalous_counterparties": float(payload.anomalous_counterparties),
        "auth_risk_score": payload.auth_risk_score,
        "device_trust_score": payload.device_trust_score,
    }
    return run_inference("fraud", inputs, repo)


@app.get("/metrics")
def metrics() -> Response:
    data = generate_latest()  # type: ignore[arg-type]
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


__all__ = ["app"]
