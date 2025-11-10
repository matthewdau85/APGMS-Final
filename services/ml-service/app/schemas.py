
from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class ShortfallRiskRequest(BaseModel):
    cash_on_hand: float = Field(..., ge=0, description="Current unrestricted cash reserves (in millions)")
    monthly_burn: float = Field(..., ge=0, description="Average monthly operating expenses (in millions)")
    obligations_due: float = Field(..., ge=0, description="Upcoming statutory obligations in the next 30 days")
    forecast_revenue: float = Field(..., ge=0, description="Projected revenue collections in the next 30 days")


class FraudRiskRequest(BaseModel):
    transfer_amount: float = Field(..., ge=0, description="Amount of the transfer in millions")
    daily_velocity: float = Field(..., ge=0, description="Total outbound transfer velocity for the org in the past 24h")
    anomalous_counterparties: int = Field(..., ge=0, description="Count of counterparties flagged in the last 7 days")
    auth_risk_score: float = Field(..., ge=0, le=1, description="Blended authentication risk score (0-1)")
    device_trust_score: float = Field(..., ge=0, le=1, description="Device posture trust score (0-1)")


class FeatureExplanation(BaseModel):
    name: str
    value: float
    weight: float
    impact: float
    rationale: str
    mitigation: str


class RiskResponse(BaseModel):
    model: str
    score: float
    threshold: float
    risk_level: str = Field(..., pattern="^(low|medium|high)$")
    exceeds_threshold: bool
    mitigations: List[str]
    top_explanations: List[FeatureExplanation]
