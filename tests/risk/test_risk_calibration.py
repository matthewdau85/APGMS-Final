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


def test_risk_calibration_matches_dataset():
    dataset = json.loads((ROOT / "data" / "risk" / "portfolio.json").read_text())
    calibration = json.loads((ROOT / "data" / "risk" / "calibration.json").read_text())

    anomaly_scores = [row["anomalyScore"] for row in dataset]
    incidents = [row["recentIncidents"] for row in dataset]
    exposures = [row["exposure"] for row in dataset]

    assert math.isclose(
        _quantile(anomaly_scores, 0.5), calibration["quantiles"]["moderate"], rel_tol=1e-6
    )
    assert math.isclose(
        _quantile(anomaly_scores, 0.8), calibration["quantiles"]["elevated"], rel_tol=1e-6
    )
    assert math.isclose(
        _quantile(anomaly_scores, 0.95), calibration["quantiles"]["severe"], rel_tol=1e-6
    )

    avg_exposure = sum(exposures) / len(exposures)
    assert math.isclose(avg_exposure, calibration["exposureBaseline"], rel_tol=1e-5)

    avg_incidents = sum(incidents) / len(incidents)
    expected_smoothing = 1 / (1 + avg_incidents)
    assert math.isclose(expected_smoothing, calibration["smoothingFactor"], rel_tol=1e-6)
