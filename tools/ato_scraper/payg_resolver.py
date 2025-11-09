# tools/ato_scraper/payg_resolver.py
from pathlib import Path
import pandas as pd
import numpy as np

_DF = None

CSV_PATH = Path(r"C:\loat-poc\data\external\ato\payg\payg_tables_normalized.csv")

SCALE = {
    "weekly": 1.0,
    "fortnightly": 2.0,          # 2 weeks
    "monthly": 52.0 / 12.0,      # ≈ 4.3333333333
}

def _load_df() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH)
    # numeric + clean
    for c in df.columns:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["income"]).sort_values("income").drop_duplicates(subset=["income"])

    # Ensure we have a weekly withholding column (source of truth).
    have_w = "withholding_weekly" in df and df["withholding_weekly"].notna().any()
    if not have_w:
        # Reconstruct weekly from whatever exists
        w = None
        if "withholding_fortnightly" in df and df["withholding_fortnightly"].notna().any():
            w = df["withholding_fortnightly"] / SCALE["fortnightly"]
        if ("withholding_monthly" in df and df["withholding_monthly"].notna().any()):
            # prefer adding/combining if both present
            wm = df["withholding_monthly"] / SCALE["monthly"]
            w = wm if w is None else w.fillna(wm)
        if w is None:
            # nothing usable — keep zeros
            df["withholding_weekly"] = 0.0
        else:
            df["withholding_weekly"] = np.floor(pd.to_numeric(w, errors="coerce").fillna(0))
    else:
        # sanitize weekly
        df["withholding_weekly"] = pd.to_numeric(df["withholding_weekly"], errors="coerce").fillna(0)

    return df[["income", "withholding_weekly"]].copy()

def _lookup_weekly(df: pd.DataFrame, weekly_amount: float) -> float:
    """Left-bound step lookup on weekly brackets."""
    incomes = df["income"].to_numpy()
    idx = np.searchsorted(incomes, weekly_amount, side="right") - 1
    if idx < 0:
        return 0.0
    val = float(df.iloc[idx]["withholding_weekly"])
    return 0.0 if not np.isfinite(val) else val

def withheld(amount: float, freq: str) -> int:
    """
    amount: **weekly** gross income
    freq: 'weekly' | 'fortnightly' | 'monthly'
    Returns integer dollars.
    """
    global _DF
    f = freq.lower()
    if f not in SCALE:
        raise ValueError("freq must be weekly|fortnightly|monthly")

    if _DF is None:
        _DF = _load_df()

    base = _lookup_weekly(_DF, float(amount))  # index by weekly only
    scaled = base * SCALE[f]
    # Floor to dollars to match ATO table behavior (non-cumulative per step)
    return int(np.floor(scaled + 1e-9))
