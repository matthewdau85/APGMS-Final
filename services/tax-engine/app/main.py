from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ValidationError, root_validator

app = FastAPI()


class GstRequest(BaseModel):
    amount: float = Field(..., description="Gross amount that may include GST")
    rate: Optional[float] = Field(
        0.1,
        description="GST rate as a decimal (defaults to 10%)",
    )


class GstResponse(BaseModel):
    gst_portion: float
    net_of_gst: float


class PaygwBracket(BaseModel):
    threshold: Optional[float] = Field(
        None,
        description="Inclusive upper bound for the bracket. Null represents no upper bound.",
    )
    rate: float = Field(..., ge=0)
    base: float = Field(...)


class PaygwRequest(BaseModel):
    taxable_income: float = Field(..., ge=0, description="Taxable income for the pay period")
    brackets: List[PaygwBracket] = Field(
        ..., description="Bracket table ordered by ascending threshold"
    )

    @root_validator
    def ensure_brackets(cls, values):  # type: ignore[override]
        brackets = values.get("brackets")
        if not brackets:
            raise ValueError("At least one bracket must be provided")
        return values


class PaygwResponse(BaseModel):
    withheld: float
    effective_rate: float


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/v1/gst", response_model=GstResponse)
async def calculate_gst_endpoint(payload: GstRequest) -> GstResponse:
    if payload.amount <= 0 or (payload.rate is not None and payload.rate <= 0):
        return GstResponse(gst_portion=0.0, net_of_gst=payload.amount)

    rate = payload.rate if payload.rate is not None else 0.1
    divisor = 1 + rate
    net_of_gst = payload.amount / divisor
    gst_portion = payload.amount - net_of_gst
    return GstResponse(
        gst_portion=_round_currency(gst_portion),
        net_of_gst=_round_currency(net_of_gst),
    )


@app.post("/v1/paygw", response_model=PaygwResponse)
async def calculate_paygw_endpoint(payload: PaygwRequest) -> PaygwResponse:
    if payload.taxable_income <= 0:
        return PaygwResponse(withheld=0.0, effective_rate=0.0)

    try:
        withheld = _calculate_paygw(payload.taxable_income, payload.brackets)
    except ValidationError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    effective_rate = min(1.0, withheld / payload.taxable_income)
    return PaygwResponse(
        withheld=_round_currency(withheld),
        effective_rate=effective_rate,
    )


def _calculate_paygw(taxable_income: float, brackets: List[PaygwBracket]) -> float:
    sorted_brackets = sorted(
        brackets,
        key=lambda item: float("inf") if item.threshold is None else item.threshold,
    )

    withheld = 0.0
    for bracket in sorted_brackets:
        withheld = max(0.0, bracket.base + bracket.rate * taxable_income)
        threshold = float("inf") if bracket.threshold is None else bracket.threshold
        if taxable_income <= threshold:
            break

    return withheld


def _round_currency(value: float) -> float:
    decimal_value = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(decimal_value)
