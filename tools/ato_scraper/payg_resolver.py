from pathlib import Path
import pandas as pd

# Repo root: .../APGMS-Final/APGMS-Final
ROOT = Path(__file__).resolve().parents[2]
CSV  = ROOT / "data" / "external" / "ato" / "payg" / "payg_tables_normalized.csv"

def _load():
    df = pd.read_csv(CSV).sort_values("income").reset_index(drop=True)
    return df

_df = None
def _get_df():
    global _df
    if _df is None:
        _df = _load()
    return _df

def _nearest_weekly(amount: float) -> int:
    df = _get_df()
    amount = float(amount)
    row = df[df["income"] <= amount].tail(1)
    if row.empty:
        row = df.head(1)
    return int(row["withholding_weekly"].iloc[0])

def withheld(amount: float, period: str="weekly") -> int:
    w = _nearest_weekly(amount)
    if period == "weekly":
        return w
    if period == "fortnightly":
        return int(round(2.0 * w))
    if period == "monthly":
        return int(round((52.0/12.0) * w))
    raise ValueError("period must be weekly|fortnightly|monthly")
