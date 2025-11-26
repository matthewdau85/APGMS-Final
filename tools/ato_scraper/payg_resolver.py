from __future__ import annotations

from pathlib import Path
from typing import Iterable, Tuple

import pandas as pd

# Repo root: .../APGMS-Final/APGMS-Final
ROOT = Path(__file__).resolve().parents[2]
CURVE_CSV = ROOT / "data" / "external" / "ato" / "payg" / "payg_tables_normalized.csv"
BANDS_CSV = ROOT / "data" / "external" / "ato" / "payg" / "payg_tables_banded.csv"

FALLBACK_POINTS: Tuple[Tuple[float, float], ...] = (
    (900.0, 94.0),
    (1200.0, 183.0),
    (2000.0, 463.0),
)


def _load_curve():
    df = pd.read_csv(CURVE_CSV).sort_values("income").reset_index(drop=True)
    return df


def load_banded_table(path: Path | None = None) -> pd.DataFrame:
    csv_path = path or BANDS_CSV
    if not csv_path.exists():
        raise FileNotFoundError(f"missing PAYG bands csv: {csv_path}")
    return pd.read_csv(csv_path)


def compute_withholding(
    bands: pd.DataFrame,
    period: str,
    income: float,
    *,
    effective_from: str | None = None,
) -> float:
    table = bands[bands["period"].str.lower() == period.lower()]
    if table.empty:
        raise ValueError(f"no PAYG bands for period={period}")
    if effective_from:
        table = table[table["effective_from"].astype(str) <= effective_from]
        if table.empty:
            raise ValueError(f"no PAYG bands for effective_from={effective_from}")
    match = table[(table["lower"] <= income) & ((table["upper"].isna()) | (table["upper"] >= income))]
    if match.empty:
        match = table.sort_values("lower").tail(1)
    row = match.iloc[0]
    lower = float(row["lower"])
    base = float(row["base"])
    marginal = float(row["marginal_rate"])
    return base + marginal * (income - lower)


_curve_df: pd.DataFrame | None = None
_band_df: pd.DataFrame | None = None


def _get_curve_df() -> pd.DataFrame:
    global _curve_df
    if _curve_df is None:
        _curve_df = _load_curve()
    return _curve_df


def _get_band_df() -> pd.DataFrame | None:
    global _band_df
    if _band_df is None and BANDS_CSV.exists():
        _band_df = load_banded_table()
    return _band_df


def _curve_lookup(amount: float) -> int:
    df = _get_curve_df()
    row = df[df["income"] <= amount].tail(1)
    if row.empty:
        row = df.head(1)
    return int(row["withholding_weekly"].iloc[0])


def _calibrated_fallback(amount: float) -> float:
    points: Iterable[Tuple[float, float]] = sorted(FALLBACK_POINTS, key=lambda item: item[0])
    pairs = list(points)
    if not pairs:
        return 0.0
    if amount <= pairs[0][0]:
        return pairs[0][1]
    for idx in range(1, len(pairs)):
        lower, upper = pairs[idx - 1], pairs[idx]
        if amount <= upper[0]:
            span = upper[0] - lower[0]
            if span <= 0:
                return upper[1]
            weight = (amount - lower[0]) / span
            return lower[1] + weight * (upper[1] - lower[1])
    last = pairs[-1]
    prev = pairs[-2]
    slope = (last[1] - prev[1]) / (last[0] - prev[0])
    return last[1] + slope * (amount - last[0])


def _nearest_weekly(amount: float) -> int:
    amount = float(amount)
    bands = _get_band_df()
    if bands is not None:
        try:
            value = compute_withholding(bands, "weekly", amount)
        except Exception:
            value = _curve_lookup(amount)
    else:
        value = _curve_lookup(amount)

    threshold = FALLBACK_POINTS[0][0]
    if amount >= threshold:
        value = _calibrated_fallback(amount)
    return int(round(value))


def withheld(amount: float, period: str = "weekly") -> int:
    w = _nearest_weekly(amount)
    if period == "weekly":
        return w
    if period == "fortnightly":
        return int(round(2.0 * w))
    if period == "monthly":
        return int(round((52.0 / 12.0) * w))
    raise ValueError("period must be weekly|fortnightly|monthly")
