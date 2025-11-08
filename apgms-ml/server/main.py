"""FastAPI application providing APGMS machine learning scoring endpoints."""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, root_validator

try:  # Optional dependency, but most models expect pandas DataFrames.
    import pandas as pd
except ImportError:  # pragma: no cover - pandas may not be available in minimal envs.
    pd = None  # type: ignore


LOGGER = logging.getLogger("apgms_ml.server")
if not LOGGER.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIRECTORY = Path(os.getenv("MODEL_DIRECTORY", REPO_ROOT / "model" / "live"))


@dataclass
class ModelBundle:
    """Container describing a loaded model and its scoring metadata."""

    name: str
    estimator: Any
    path: Path
    threshold: Optional[float]

    def override_threshold(self, env_value: Optional[str]) -> None:
        if not env_value:
            return
        try:
            self.threshold = float(env_value)
            LOGGER.info(
                "Overrode threshold via environment",
                extra={"surface": self.name, "threshold": self.threshold},
            )
        except ValueError:
            LOGGER.warning(
                "Invalid threshold override; keeping existing value",
                extra={"surface": self.name, "env": env_value},
            )


def load_model_bundle(model_path: Path) -> ModelBundle:
    obj = joblib.load(model_path)
    threshold: Optional[float] = None
    estimator = obj

    if isinstance(obj, Mapping):
        estimator = obj.get("model") or obj.get("estimator") or obj
        threshold = obj.get("threshold") or obj.get("match_threshold")

    if threshold is None and hasattr(estimator, "threshold"):
        try:
            threshold = float(getattr(estimator, "threshold"))
        except (TypeError, ValueError):
            threshold = None

    bundle = ModelBundle(
        name=model_path.stem.lower(),
        estimator=estimator,
        path=model_path,
        threshold=threshold,
    )
    bundle.override_threshold(os.getenv(f"MATCH_THRESHOLD_{bundle.name.upper()}"))
    return bundle


def load_models(directory: Path) -> Dict[str, ModelBundle]:
    registry: Dict[str, ModelBundle] = {}
    if not directory.exists():
        LOGGER.warning("Model directory missing", extra={"directory": str(directory)})
        return registry

    for path in sorted(directory.glob("*.joblib")):
        try:
            bundle = load_model_bundle(path)
        except Exception:  # pragma: no cover - defensive logging.
            LOGGER.exception("Failed to load model", extra={"path": str(path)})
            continue
        registry[bundle.name] = bundle
        LOGGER.info(
            "Loaded model",
            extra={
                "surface": bundle.name,
                "path": str(bundle.path),
                "threshold": bundle.threshold,
            },
        )
    return registry


def ensure_features(payload: Mapping[str, Any]) -> Any:
    if pd is None:
        raise RuntimeError(
            "pandas is required to prepare features for scoring. Install pandas to continue."
        )
    return pd.DataFrame([payload])


def payload_to_mapping(model: BasePayload) -> Dict[str, Any]:
    data = model.dict()
    for key, value in model.__dict__.items():
        if key not in data and not key.startswith("_"):
            data[key] = value
    return data


def extract_probability(estimator: Any, features: Any) -> float:
    if hasattr(estimator, "predict_proba"):
        proba = estimator.predict_proba(features)
        if isinstance(proba, Iterable):
            first_row = next(iter(proba))
            if isinstance(first_row, Iterable) and not isinstance(first_row, (float, int)):
                first_row = list(first_row)
                if len(first_row) > 1:
                    return float(first_row[1])
            return float(first_row)
    if hasattr(estimator, "predict"):
        prediction = estimator.predict(features)
        if isinstance(prediction, Iterable):
            prediction = next(iter(prediction))
        return float(prediction)
    raise RuntimeError("Estimator does not expose a probability or prediction method")


def extract_prediction(estimator: Any, features: Any) -> Any:
    if hasattr(estimator, "predict"):
        prediction = estimator.predict(features)
        if isinstance(prediction, Iterable) and not isinstance(prediction, (str, bytes, dict)):
            return next(iter(prediction))
        return prediction
    raise RuntimeError("Estimator does not expose a prediction method")


def band_from_probability(probability: float) -> str:
    if probability >= 0.8:
        return "high"
    if probability >= 0.5:
        return "medium"
    return "low"


class BasePayload(BaseModel):
    class Config:
        extra = "allow"

    @root_validator(pre=True)
    def ensure_not_empty(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        if not values:
            raise ValueError("Payload must include at least one feature")
        return values


class GstFreePayload(BasePayload):
    line_desc: str = Field(..., description="Invoice line description")
    qty: float = Field(..., gt=0, description="Quantity for the line")
    unit_price: float = Field(..., description="Unit price for the line item")
    abn_age_days: int = Field(..., ge=0, description="Age of ABN in days")
    ship_to_country: str = Field(..., min_length=2, description="Destination country code")


class BasConfidencePayload(BasePayload):
    period: str = Field(..., description="BAS reporting period identifier")
    box: str = Field(..., description="BAS box identifier")


class PaygwVariancePayload(BasePayload):
    pass


class DuplicatesPayload(BasePayload):
    tid_a: str = Field(..., description="Primary transaction identifier")
    tid_b: str = Field(..., description="Candidate duplicate transaction identifier")


class ApportionPayload(BasePayload):
    pass


class GstFreeResponse(BaseModel):
    p: float
    keep: bool
    threshold: float


class BasConfidenceResponse(BaseModel):
    p: float
    band: str


class PaygwVarianceResponse(BaseModel):
    band: str


class DuplicatesResponse(BaseModel):
    p: float
    keep: bool


class ApportionResponse(BaseModel):
    pct: float
    confidence: float


app = FastAPI(title="APGMS ML Scoring Service", version="1.0.0")
MODEL_REGISTRY: Dict[str, ModelBundle] = {}


@app.on_event("startup")
def startup_event() -> None:
    global MODEL_REGISTRY
    MODEL_REGISTRY = load_models(MODEL_DIRECTORY)
    if not MODEL_REGISTRY:
        LOGGER.warning("No models were loaded; scoring endpoints will fail until models exist")


def get_bundle(surface: str) -> ModelBundle:
    bundle = MODEL_REGISTRY.get(surface)
    if not bundle:
        raise HTTPException(status_code=503, detail=f"Model for surface '{surface}' unavailable")
    return bundle


def threshold_for(bundle: ModelBundle, default: float = 0.5) -> float:
    return float(bundle.threshold) if bundle.threshold is not None else default


@app.post("/score/gstfree", response_model=GstFreeResponse)
async def score_gstfree(payload: GstFreePayload) -> GstFreeResponse:
    start = time.perf_counter()
    bundle = get_bundle("gstfree")
    features = ensure_features(payload_to_mapping(payload))
    probability = extract_probability(bundle.estimator, features)
    threshold = threshold_for(bundle)
    keep = probability >= threshold
    elapsed_ms = (time.perf_counter() - start) * 1000
    LOGGER.info(
        "Scored gstfree",
        extra={
            "surface": "gstfree",
            "probability": probability,
            "threshold": threshold,
            "keep": keep,
            "duration_ms": round(elapsed_ms, 3),
        },
    )
    return GstFreeResponse(p=probability, keep=keep, threshold=threshold)


@app.post("/score/bas_conf", response_model=BasConfidenceResponse)
async def score_bas_conf(payload: BasConfidencePayload) -> BasConfidenceResponse:
    start = time.perf_counter()
    bundle = get_bundle("bas_conf")
    features = ensure_features(payload_to_mapping(payload))
    probability = extract_probability(bundle.estimator, features)
    band_prediction = None
    try:
        band_prediction = extract_prediction(bundle.estimator, features)
    except Exception:
        band_prediction = None
    band = str(band_prediction) if band_prediction is not None else band_from_probability(probability)
    elapsed_ms = (time.perf_counter() - start) * 1000
    LOGGER.info(
        "Scored bas_conf",
        extra={
            "surface": "bas_conf",
            "probability": probability,
            "band": band,
            "duration_ms": round(elapsed_ms, 3),
        },
    )
    return BasConfidenceResponse(p=probability, band=band)


@app.post("/score/paygw_var", response_model=PaygwVarianceResponse)
async def score_paygw_var(payload: PaygwVariancePayload) -> PaygwVarianceResponse:
    start = time.perf_counter()
    bundle = get_bundle("paygw_var")
    features = ensure_features(payload_to_mapping(payload))
    prediction = extract_prediction(bundle.estimator, features)
    band = str(prediction)
    elapsed_ms = (time.perf_counter() - start) * 1000
    LOGGER.info(
        "Scored paygw_var",
        extra={
            "surface": "paygw_var",
            "band": band,
            "duration_ms": round(elapsed_ms, 3),
        },
    )
    return PaygwVarianceResponse(band=band)


@app.post("/score/dups", response_model=DuplicatesResponse)
async def score_dups(payload: DuplicatesPayload) -> DuplicatesResponse:
    start = time.perf_counter()
    bundle = get_bundle("dups")
    features = ensure_features(payload_to_mapping(payload))
    probability = extract_probability(bundle.estimator, features)
    threshold = threshold_for(bundle)
    keep = probability >= threshold
    elapsed_ms = (time.perf_counter() - start) * 1000
    LOGGER.info(
        "Scored dups",
        extra={
            "surface": "dups",
            "probability": probability,
            "threshold": threshold,
            "keep": keep,
            "duration_ms": round(elapsed_ms, 3),
        },
    )
    return DuplicatesResponse(p=probability, keep=keep)


@app.post("/score/apportion", response_model=ApportionResponse)
async def score_apportion(payload: ApportionPayload) -> ApportionResponse:
    start = time.perf_counter()
    bundle = get_bundle("apportion")
    features = ensure_features(payload_to_mapping(payload))
    pct_prediction = extract_prediction(bundle.estimator, features)
    try:
        pct_value = float(pct_prediction)
    except (TypeError, ValueError):
        raise HTTPException(status_code=500, detail="Apportion model must return numeric proportion")
    try:
        confidence = extract_probability(bundle.estimator, features)
    except Exception:
        confidence = 1.0
    elapsed_ms = (time.perf_counter() - start) * 1000
    LOGGER.info(
        "Scored apportion",
        extra={
            "surface": "apportion",
            "pct": pct_value,
            "confidence": confidence,
            "duration_ms": round(elapsed_ms, 3),
        },
    )
    return ApportionResponse(pct=pct_value, confidence=float(confidence))


@app.get("/healthz")
async def healthcheck() -> Dict[str, Any]:
    return {
        "status": "ok",
        "models": sorted(MODEL_REGISTRY.keys()),
        "model_directory": str(MODEL_DIRECTORY),
    }


@app.get("/")
async def root() -> Dict[str, Any]:
    return {
        "service": "apgms-ml-scoring",
        "version": "1.0.0",
        "endpoints": [
            "/score/gstfree",
            "/score/bas_conf",
            "/score/paygw_var",
            "/score/dups",
            "/score/apportion",
        ],
    }
