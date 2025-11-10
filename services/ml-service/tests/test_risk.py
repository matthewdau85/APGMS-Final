from fastapi.testclient import TestClient
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app


def test_shortfall_low_risk():
    payload = {
        "cash_on_hand": 6.5,
        "monthly_burn": 1.2,
        "obligations_due": 0.8,
        "forecast_revenue": 3.4,
    }
    with TestClient(app) as client:
        response = client.post("/risk/shortfall", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "shortfall"
    assert body["score"] < body["threshold"]
    assert body["risk_level"] in {"low", "medium"}


def test_shortfall_high_risk():
    payload = {
        "cash_on_hand": 0.5,
        "monthly_burn": 4.0,
        "obligations_due": 3.2,
        "forecast_revenue": 0.4,
    }
    with TestClient(app) as client:
        response = client.post("/risk/shortfall", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "shortfall"
    assert body["score"] >= body["threshold"]
    assert body["exceeds_threshold"] is True


def test_fraud_inference_blocks_when_threshold_crossed():
    payload = {
        "transfer_amount": 5.0,
        "daily_velocity": 12.0,
        "anomalous_counterparties": 3,
        "auth_risk_score": 0.9,
        "device_trust_score": 0.2,
    }
    with TestClient(app) as client:
        response = client.post("/risk/fraud", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "fraud"
    assert body["exceeds_threshold"] is True
    assert any("MFA" in step for step in body["mitigations"])  # mitigation text surfaces actions


def test_metrics_endpoint_exposes_prometheus_payload():
    with TestClient(app) as client:
        response = client.get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert b"ml_service_inference_total" in response.content
