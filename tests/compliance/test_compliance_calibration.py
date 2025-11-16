import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _quantile(values, percentile):
    if len(values) == 1:
        return float(values[0])
    sorted_values = sorted(values)
    rank = percentile * (len(sorted_values) - 1)
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return float(sorted_values[lower])
    weight = rank - lower
    return float(sorted_values[lower] + weight * (sorted_values[upper] - sorted_values[lower]))


def _latency(row):
    return row["reportLagDays"] + row["missingEvidence"] * 4 + row["manualTouches"] * 2


def test_compliance_calibration_matches_dataset():
    dataset = json.loads((ROOT / "data" / "compliance" / "obligations.json").read_text())
    calibration = json.loads((ROOT / "data" / "compliance" / "calibration.json").read_text())

    latencies = [_latency(row) for row in dataset]
    avg_lag = sum(row["reportLagDays"] for row in dataset) / len(dataset)
    avg_manual = sum(row["manualTouches"] for row in dataset) / len(dataset)
    expected_auto = max(0, 1 - avg_manual / 4)

    for key, percentile in (("baseline", 0.5), ("warning", 0.8), ("breach", 0.95)):
        assert math.isclose(
            _quantile(latencies, percentile), calibration["latencyQuantiles"][key], rel_tol=1e-6
        )

    assert math.isclose(avg_lag, calibration["averageLagDays"], rel_tol=1e-6)
    assert math.isclose(expected_auto, calibration["autoCoverage"], rel_tol=1e-3)
