from __future__ import annotations
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
EXTRACTED = ROOT / "data" / "external" / "ato" / "payg" / "extracted"
OUT_CSV   = ROOT / "data" / "external" / "ato" / "payg" / "payg_tables_normalized.csv"

WEEKLY    = EXTRACTED / "weekly.csv"
FORTNIGHT = EXTRACTED / "fortnightly.csv"
MONTHLY   = EXTRACTED / "monthly.csv"

def _read_csv_any(path: Path) -> pd.DataFrame:
    # Try common encodings found in Windows-extracted CSVs
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    # Last resort: replace undecodable bytes
    return pd.read_csv(path, encoding="utf-8", encoding_errors="replace")

def _read_period_csv(p: Path, period: str) -> pd.DataFrame:
    if not p.exists():
        raise FileNotFoundError(f"Missing source CSV for {period}: {p}")

    df = _read_csv_any(p)
    cols = list(df.columns)
    if not cols:
        raise ValueError(f"No columns found in {p}")
    income_col = cols[0]

    withheld_like = [c for c in cols if "withheld" in c.lower()]
    if not withheld_like:
        withheld_like = [c for c in cols[1:] if pd.api.types.is_numeric_dtype(df.get(c))]

    if withheld_like:
        tax = pd.DataFrame({"tax": df[withheld_like].min(axis=1, skipna=True)})
    else:
        tax = pd.DataFrame({"tax": np.zeros(len(df), dtype=float)})

    out = pd.DataFrame({
        "income": pd.to_numeric(df[income_col], errors="coerce"),
        "tax": pd.to_numeric(tax["tax"], errors="coerce"),
    }).dropna(subset=["income"])

    if period == "weekly":
        out["withholding_weekly"] = out["tax"].clip(lower=0)
    elif period == "fortnightly":
        out["withholding_weekly"] = (out["tax"] / 2.0).clip(lower=0)
    elif period == "monthly":
        out["withholding_weekly"] = (out["tax"] / (52.0 / 12.0)).clip(lower=0)
    else:
        raise ValueError(f"unknown period: {period}")

    return out[["income", "withholding_weekly"]]

def main():
    pieces = []
    if WEEKLY.exists():
        print(f"[weekly] reading: {WEEKLY}")
        pieces.append(_read_period_csv(WEEKLY, "weekly"))
    else:
        print("[weekly] missing, skipping")
    if FORTNIGHT.exists():
        print(f"[fortnight] reading: {FORTNIGHT}")
        pieces.append(_read_period_csv(FORTNIGHT, "fortnightly"))
    else:
        print("[fortnight] missing, skipping")
    if MONTHLY.exists():
        print(f"[monthly] reading: {MONTHLY}")
        pieces.append(_read_period_csv(MONTHLY, "monthly"))
    else:
        print("[monthly] missing, skipping")

    if not pieces:
        raise SystemExit("No source CSVs found under extracted/. Nothing to normalize.")

    df = pd.concat(pieces, ignore_index=True)
    df = (df.groupby("income", as_index=False)["withholding_weekly"]
            .min().sort_values("income").reset_index(drop=True))
    df["withholding_weekly"] = df["withholding_weekly"].fillna(0).clip(lower=0)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_CSV, index=False)
    print(f"WROTE {OUT_CSV}")
    print(f"ROWS: {len(df)} MIN/MAX income: {df['income'].min()} {df['income'].max()}")
    nz = int((df['withholding_weekly'] > 0).sum())
    print(f"NONZERO rows: {nz}")

if __name__ == "__main__":
    main()
