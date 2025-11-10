"""Request and response schemas for the ML service."""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List


class ShortfallRequest(BaseModel):
    org_id: str = Field(..., alias="orgId")
    liquidity_coverage: float = Field(..., alias="liquidityCoverage", ge=0)
    escrow_coverage: float = Field(..., alias="escrowCoverage", ge=0)
    outstanding_alerts: int = Field(..., alias="outstandingAlerts", ge=0)
    bas_window_days: int = Field(..., alias="basWindowDays", ge=0)
    recent_shortfalls: int = Field(..., alias="recentShortfalls", ge=0)

    class Config:
        populate_by_name = True


class FraudRequest(BaseModel):
    transaction_id: str = Field(..., alias="transactionId")
    amount: float = Field(..., ge=0)
    channel_risk: float = Field(..., alias="channelRisk", ge=0)
    velocity: float = Field(..., ge=0)
    geo_distance: float = Field(..., alias="geoDistance", ge=0)
    account_tenure_days: int = Field(..., alias="accountTenureDays", ge=0)
    previous_incidents: int = Field(..., alias="previousIncidents", ge=0)

    class Config:
        populate_by_name = True


class FeatureImpactResponse(BaseModel):
    feature: str
    weight: float
    impact: float


class RiskResponse(BaseModel):
    model_version: str = Field(..., alias="modelVersion")
    risk_score: float = Field(..., alias="riskScore")
    risk_level: str = Field(..., alias="riskLevel")
    recommended_mitigations: List[str] = Field(..., alias="recommendedMitigations")
    explanation: str
    contributing_factors: List[FeatureImpactResponse] = Field(..., alias="contributingFactors")

    class Config:
        populate_by_name = True
