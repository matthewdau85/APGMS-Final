import os, pandas as pd, numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CSV  = os.path.join(ROOT, "data", "external", "ato", "payg", "payg_tables_normalized.csv")

def test_csv_exists_and_cols():
    assert os.path.exists(CSV)
    df = pd.read_csv(CSV)
    assert "income" in df.columns and "withholding_weekly" in df.columns

def test_monotone_and_steps():
    df = pd.read_csv(CSV).sort_values("income").reset_index(drop=True)
    w = df["withholding_weekly"].to_numpy()
    d = np.diff(w)
    assert np.all(d >= -1e-9)
    assert np.quantile(d, 0.95) <= 1.001
