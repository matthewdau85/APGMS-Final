import math
from pathlib import Path
import pandas as pd
import numpy as np
import re
import sys

# ---------- Paths ----------
EXTR = Path(r"C:\loat-poc\data\external\ato\payg\extracted")
OUT  = Path(r"C:\loat-poc\data\external\ato\payg\payg_tables_normalized.csv")

FILES = [
    ("weekly",     EXTR / "weekly.csv",      1.0),               # already weekly
    ("fortnight",  EXTR / "fortnightly.csv", 1.0/2.0),           # convert to weekly
    ("monthly",    EXTR / "monthly.csv",     1.0/4.333333333),   # convert to weekly
]

NUM_RE = re.compile(r"[^0-9.\-]")

# ---------- IO helpers ----------
def read_csv_robust(path: Path) -> pd.DataFrame:
    for enc in ("utf-8-sig","utf-8","cp1252","latin1"):
        try:
            return pd.read_csv(path, dtype=str, keep_default_na=False, encoding=enc)
        except UnicodeDecodeError:
            continue
    return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8", errors="replace")

def to_numeric_series(s: pd.Series) -> pd.Series:
    # Accept mixed types; only strip chars on strings
    if s.dtype == object:
        s = s.map(lambda x: np.nan if x in (None, "", "nan", "NaN") else x)
        s = s.map(lambda x: np.nan if isinstance(x, float) and np.isnan(x) else (NUM_RE.sub("", x) if isinstance(x, str) else x))
    return pd.to_numeric(s, errors="coerce")

# ---------- Column picking ----------
def pick_income_col(df: pd.DataFrame, label: str) -> str | None:
    # Fast path: Tabula often names the income column "Unnamed: 0"
    for c in df.columns:
        if str(c).lower().startswith("unnamed"):
            if to_numeric_series(df[c]).notna().sum() >= 10:
                return c
    # Otherwise, best monotone/range numeric column
    def score_income(series: pd.Series) -> float:
        s = to_numeric_series(series).dropna()
        n = len(s)
        if n < 12: return -1e9
        if s.min() < 0: return -1e9
        d = s.diff().dropna()
        mono = (d >= -1e-9).mean() if len(d) else 0.0
        rng  = float(s.max() - s.min()) if n else 0.0
        if rng <= 0: return -1e9
        return mono*1000.0 + min(n, 1000) + math.log1p(rng)*25.0

    best = (float("-inf"), None)
    for c in df.columns:
        sc = score_income(df[c])
        if sc > best[0]:
            best = (sc, c)
    return best[1]

def pick_withheld_col(df: pd.DataFrame, income_col: str | None) -> tuple[str, str]:
    """
    Return (mode, column_name_or_tag)
      mode:
        - 'explicit' : a single explicit 'Amount to be withheld' column
        - 'rowmin'   : take row-wise minimum across withheld-like columns
        - 'heur'     : best heuristic single column
    """
    lowers = {c.lower(): c for c in df.columns}

    # 1) Prefer explicit 'Amount to be withheld'
    explicit = next((orig for lc, orig in lowers.items()
                     if "amount to be withheld" in lc), None)
    if explicit is not None and to_numeric_series(df[explicit]).notna().sum() >= 5:
        return ("explicit", explicit)

    # 2) If multiple withheld-like columns exist, use their row-wise minimum
    wl = []
    for lc, orig in lowers.items():
        if any(k in lc for k in ("withheld","withholding")):
            if to_numeric_series(df[orig]).notna().sum() >= 5:
                wl.append(orig)
    # Also consider obvious "amount" columns whose data looks like withholding
    for lc, orig in lowers.items():
        if "amount to" in lc and orig not in wl:
            if to_numeric_series(df[orig]).notna().sum() >= 5:
                wl.append(orig)

    if len(wl) >= 2:
        return ("rowmin", "<row-wise min of withheld-like columns>")

    # 3) Fallback: one decent numeric column that isn't the income column
    if len(wl) == 1:
        return ("explicit", wl[0])

    # Heuristic pick
    best = (float("-inf"), None)
    inc = to_numeric_series(df[income_col]) if income_col else None
    for c in df.columns:
        if income_col and c == income_col:
            continue
        s = to_numeric_series(df[c]).dropna()
        if len(s) < 8 or (s != 0).sum() < 5:
            continue
        # avoid income-like slope ~1
        if inc is not None:
            both = pd.concat([inc, to_numeric_series(df[c])], axis=1, keys=["x","y"]).dropna()
            if len(both) >= 20:
                cov = np.cov(both["x"], both["y"])
                varx = cov[0,0] if cov.shape==(2,2) else 0.0
                b = cov[0,1]/varx if varx>0 else 0.0
                if 0.8 < b < 1.2:
                    continue
        d = s.diff().dropna()
        mono = (d >= -1e-9).mean() if len(d) else 0.0
        score = mono*1000.0 + min(len(s), 1000)
        if score > best[0]:
            best = (score, c)
    if best[1] is not None:
        return ("heur", best[1])
    return ("heur", list(df.columns)[0])

# ---------- Loader ----------
def load_one(label: str, path: Path, to_weekly_factor: float) -> pd.DataFrame:
    print(f"[{label}] reading:", path)
    if not path.exists():
        print(f"[{label}] MISSING")
        return pd.DataFrame(columns=["income","withholding_weekly"])

    raw = read_csv_robust(path)
    raw.columns = [str(c).strip() for c in raw.columns]
    print(f"[{label}] headers:", list(raw.columns)[:12])
    print(f"[{label}] preview:\n", raw.head(8).to_string(index=False))

    inc_col = pick_income_col(raw, label)
    print(f"[{label}] income_col ->", inc_col)
    if inc_col is None:
        return pd.DataFrame(columns=["income","withholding_weekly"])

    mode, tax_pick = pick_withheld_col(raw, inc_col)
    print(f"[{label}] tax_col ->", tax_pick)

    inc = to_numeric_series(raw[inc_col])

    if mode == "explicit":
        tax = to_numeric_series(raw[tax_pick])
    elif mode == "rowmin":
        candidates = []
        for c in raw.columns:
            lc = c.lower()
            if ("withheld" in lc or "withholding" in lc or "amount to" in lc):
                s = to_numeric_series(raw[c])
                if s.notna().sum() >= 5:
                    candidates.append(s)
        if candidates:
            # row-wise min across candidates; robust to NaNs
            tax = pd.concat(candidates, axis=1).min(axis=1, skipna=True)
        else:
            tax = pd.Series(np.nan, index=raw.index)
    else:
        tax = to_numeric_series(raw[tax_pick])

    out = pd.DataFrame({"income": inc, "tax": tax}).dropna(subset=["income"])

    # Normalize to weekly
    income_scale = 1.0 if label == "weekly" else (0.5 if label == "fortnight" else 1.0/4.333333333)
    out["income"] = out["income"] * income_scale
    out["withholding_weekly"] = out["tax"].fillna(0) * to_weekly_factor

    # Clamp negatives to 0
    out["withholding_weekly"] = out["withholding_weekly"].clip(lower=0)

    out = out[(out["income"]>0) & (out["income"]<1e7)]
    out = out.sort_values("income").drop_duplicates(subset=["income"])
    print(f"[{label}] produced rows:", len(out))
    print(f"[{label}] sample:\n", out.head(10).to_string(index=False))
    return out[["income","withholding_weekly"]]

# ---------- Isotonic regression ----------
def isotonic_non_decreasing(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """
    Pool-Adjacent-Violators (PAV) ??? optional weights=1.
    """
    order = np.argsort(x)
    x = x[order]
    y = y[order]
    n = len(y)
    g = y.astype(float).copy()
    w = np.ones(n, dtype=float)
    i = 0
    while i < n-1:
        if g[i] <= g[i+1] + 1e-12:
            i += 1
            continue
        # merge backward
        j = i
        while j >= 0 and g[j] > g[j+1] + 1e-12:
            total_w = w[j] + w[j+1]
            g[j] = g[j+1] = (w[j]*g[j] + w[j+1]*g[j+1]) / total_w
            w[j] = w[j+1] = total_w
            j -= 1
        i = max(j+1, 0)
    out = np.empty_like(g)
    out[order] = g
    return out

# ---------- Main ----------
def main() -> int:
    parts = []
    for label, path, factor in FILES:
        try:
            one = load_one(label, path, factor)
            if not one.empty:
                parts.append(one)
        except Exception as e:
            print(f"[{label}] ERROR:", e, file=sys.stderr)

    if not parts:
        print("No usable rows detected in extracted CSVs. Open weekly/fortnightly/monthly CSVs and check headers/cells.")
        return 1

    union = pd.concat(parts, ignore_index=True)

    # Bucket income to cents and aggregate ROBUSTLY:
    # Take median across sources per bucket, preferring positive values if any.
    union["bucket"] = (union["income"]*2).round().div(2)  # buckets of $0.50
    grouped = (
        union.groupby("bucket", as_index=False)
             .agg(income=("income", "mean"),
                  # prefer median of positives; else median including zeros
                  withholding_weekly=("withholding_weekly",
                                      lambda s: float(s[s>0].median()) if (s>0).any() else float(s.median())))
    )

    # Light median smoothing (remove tiny OCR wiggles)
    grouped["withholding_weekly"] = (
        grouped["withholding_weekly"]
        .rolling(5, center=True, min_periods=1)
        .median()
    )

    # Enforce monotone non-decreasing via isotonic regression
    x = grouped["income"].to_numpy()
    y = grouped["withholding_weekly"].to_numpy()
    y_iso = isotonic_non_decreasing(x, y)
    grouped["withholding_weekly"] = y_iso

    grouped = grouped.sort_values("income")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    grouped[["income","withholding_weekly"]].to_csv(OUT, index=False)

    print("WROTE", OUT)
    print("ROWS:", len(grouped), "MIN/MAX income:", float(grouped["income"].min()), float(grouped["income"].max()))
    nz = int((grouped["withholding_weekly"]>0).sum())
    print("NONZERO rows:", nz)
    print("\nSAMPLE:\n", grouped.head(12).to_string(index=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

