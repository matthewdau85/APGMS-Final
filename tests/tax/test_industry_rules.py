import json
from pathlib import Path
from typing import Any, Dict, Tuple

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "shared" / "src" / "rules" / "industry-rules.json"

with DATA.open("r", encoding="utf-8") as handle:
    CATALOG = json.load(handle)


def _find_profile(industry_id: str) -> Dict[str, Any]:
    for profile in CATALOG["industries"]:
        if profile["id"] == industry_id:
            return profile
    raise KeyError(f"industry {industry_id} not found")


def _find_schedule(profile: Dict[str, Any], schedule_id: str) -> Dict[str, Any]:
    for schedule in profile["schedules"]:
        if schedule["id"] == schedule_id:
            return schedule
    raise KeyError(f"schedule {schedule_id} not found")


def _condition_met(condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
    value = context.get(condition["field"])
    target = condition.get("value")
    op = condition["operator"]
    if op == "gte":
        return isinstance(value, (int, float)) and isinstance(target, (int, float)) and value >= target
    if op == "gt":
        return isinstance(value, (int, float)) and isinstance(target, (int, float)) and value > target
    if op == "lte":
        return isinstance(value, (int, float)) and isinstance(target, (int, float)) and value <= target
    if op == "lt":
        return isinstance(value, (int, float)) and isinstance(target, (int, float)) and value < target
    if op == "eq":
        return value == target
    return False


def _execute_calculation(calculation: Dict[str, Any], base: float) -> float:
    if base <= 0:
        return 0.0
    if calculation["type"] == "percentage":
        threshold = calculation.get("threshold", 0.0)
        minimum = calculation.get("minimum", 0.0)
        taxable = max(0.0, base - threshold)
        return max(minimum, taxable * calculation["rate"])
    if calculation["type"] == "progressive":
        for tier in calculation["tiers"]:
            up_to = tier["upTo"]
            if up_to is None or base <= up_to:
                return max(0.0, tier["base"] + tier["rate"] * base)
        last = calculation["tiers"][-1]
        return max(0.0, last["base"] + last["rate"] * base)
    if calculation["type"] == "fixed":
        return max(0.0, calculation["amount"])
    return 0.0


def _evaluate_schedule(industry_id: str, schedule_id: str, context: Dict[str, Any]) -> Tuple[float, float]:
    profile = _find_profile(industry_id)
    schedule = _find_schedule(profile, schedule_id)
    base_field = "payrollAmount" if schedule["basis"] == "payroll" else "revenueAmount"
    base_amount = max(0.0, float(context.get(base_field, 0.0)))
    effective_base = base_amount
    multiplier = 1.0
    suspended = False

    for exemption in profile["exemptions"]:
        if schedule_id not in exemption["appliesTo"]:
            continue
        if not _condition_met(exemption["condition"], {**context, "baseAmount": base_amount}):
            continue
        effect = exemption["effect"]
        if effect["type"] == "amount_discount":
            effective_base = max(0.0, effective_base - float(effect["amount"]))
        elif effect["type"] == "rate_discount":
            multiplier *= float(effect["multiplier"])
        elif effect["type"] == "suspend":
            suspended = True

    calculated = _execute_calculation(schedule["calculation"], effective_base)
    if suspended:
        return 0.0, effective_base
    return round((calculated * multiplier + 1e-9) * 100) / 100.0, effective_base


def test_hospitality_seasonal_discount():
    result, effective_base = _evaluate_schedule(
        "hospitality_tourism",
        "hospitality_paygw_casual",
        {
            "payrollAmount": 1800,
            "seasonalRatio": 0.3,
        },
    )
    assert effective_base == 1800
    assert result == 666.4  # 784 * 0.85 after concession


def test_construction_apprentice_offset():
    result, effective_base = _evaluate_schedule(
        "construction_trades",
        "construction_paygw_apprentice",
        {
            "payrollAmount": 2200,
            "apprenticeCount": 3,
        },
    )
    assert effective_base == 1400  # $800 discount applied before tiers
    assert result == 224.0


def test_healthcare_nfp_gst_relief():
    result, effective_base = _evaluate_schedule(
        "healthcare_allied",
        "health_gst_mixed",
        {
            "revenueAmount": 200000,
            "isNotForProfit": True,
            "healthcareExemptRatio": 0.7,
        },
    )
    assert effective_base == 200000
    assert result == 0.0
