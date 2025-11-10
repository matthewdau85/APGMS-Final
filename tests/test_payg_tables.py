from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CSV  = ROOT / "data" / "external" / "ato" / "payg" / "payg_tables_normalized.csv"

def test_csv_exists_and_cols():
    assert CSV.exists(), f"missing: {CSV}"
    df = pd.read_csv(CSV)
    assert {"income", "withholding_weekly"}.issubset(df.columns)

def test_monotone_and_steps():
    df = pd.read_csv(CSV).sort_values("income").reset_index(drop=True)
    w = df["withholding_weekly"].to_numpy()
    d = np.diff(w)
    assert np.all(d >= -1e-9), "withholding must be non-decreasing"
    assert np.quantile(d, 0.95) <= 1.001, "95th percentile step too large"
