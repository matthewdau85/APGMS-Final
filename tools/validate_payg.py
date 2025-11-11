#!/usr/bin/env python3
"""
Robust PAYG validator against a normalized, banded table.

Canonical fields we want downstream:
  period, lower, upper, base, marginal_rate, effective_from, [effective_to], [ato_source], [version]

This script:
- normalizes header names (lowercase, trims, spaces/dashes -> _ , strips BOM)
- maps common header aliases to canonical names
- auto-detects delimiter if needed (comma/semicolon/tab)
- runs simple band/overlap checks

Usage:
  python tools/validate_payg.py --path data/external/ato/payg/payg_tables_banded.csv
"""

import csv
import sys
import math  # reserved for future numeric checks
import pathlib
import argparse
from typing import Dict, List, Optional
from collections import defaultdict

# Default path; can be overridden with --path
CSV_PATH = pathlib.Path("data/external/ato/payg/payg_tables_banded.csv")

# Map common header variants -> canonical names
ALIASES = {
    "period": "period", "pay_period": "period", "frequency": "period",

    "lower": "lower", "lower_bound": "lower", "lower_income": "lower",
    "from": "lower", "min": "lower",

    "upper": "upper", "upper_bound": "upper", "upper_income": "upper",
    "to": "upper", "max": "upper",

    "base": "base", "base_amount": "base", "base_tax": "base", "fixed": "base",

    "marginal_rate": "marginal_rate", "rate": "marginal_rate",
    "marginal": "marginal_rate", "marginalrate": "marginal_rate",

    "effective_from": "effective_from", "effectivefrom": "effective_from", "start_date": "effective_from",

    "effective_to": "effective_to", "effectiveto": "effective_to", "end_date": "effective_to",

    "ato_source": "ato_source", "source": "ato_source",
    "version": "version",
}

REQUIRED = {"period", "lower", "upper", "base", "marginal_rate", "effective_from"}

def normalize_name(name: str) -> str:
    name = name.replace("\ufeff", "")  # strip BOM if present
    name = name.strip().lower()
    for ch in (" ", "-", "."):
        name = name.replace(ch, "_")
    name = "_".join(filter(None, name.split("_")))  # collapse repeats
    return name

def sniff_delimiter(path: pathlib.Path) -> str:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096)
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t"])
        return dialect.delimiter
    except Exception:
        return ","  # default

def make_field_map(fieldnames: List[str]) -> Dict[str, str]:
    norm_to_actual: Dict[str, str] = {}
    for raw in fieldnames or []:
        norm_to_actual[normalize_name(raw)] = raw

    mapping: Dict[str, str] = {}
    for norm, actual in norm_to_actual.items():
        canon = ALIASES.get(norm)
        if canon and canon not in mapping:
            mapping[canon] = actual

    missing = [c for c in REQUIRED if c not in mapping]
    if missing:
        diag = {
            "csv_fields_seen": fieldnames,
            "normalized_seen": sorted(norm_to_actual.keys()),
            "canonical_missing": missing,
            "tip": "Either rename the CSV headers or extend ALIASES in this file.",
        }
        raise SystemExit(f"ERROR: Required columns missing after mapping.\n{diag}")
    return mapping

def read_rows() -> List[Dict]:
    if not CSV_PATH.exists():
        raise SystemExit(f"ERROR: Missing table: {CSV_PATH}")

    delim = sniff_delimiter(CSV_PATH)
    rows: List[Dict] = []
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f, delimiter=delim)
        if not r.fieldnames:
            raise SystemExit("ERROR: Could not read headers; is the file empty?")
        fmap = make_field_map(r.fieldnames)

        for row in r:
            # skip blank lines
            if not any(val and str(val).strip() for val in row.values()):
                continue

            def get(canon: str, default: Optional[str] = None) -> Optional[str]:
                actual = fmap.get(canon)
                val = row.get(actual) if actual else None
                if isinstance(val, str):
                    val = val.strip()
                return default if (val is None or val == "") else val

            period   = (get("period", "") or "").lower()
            lower    = int(float(get("lower", "0")))
            upper_s  = get("upper", "")
            upper    = int(float(upper_s)) if (upper_s not in (None, "")) else None
            base     = float(get("base", "0"))
            rate     = float(get("marginal_rate", "0"))
            eff_from = str(get("effective_from", "") or "")
            eff_to   = str(get("effective_to", "") or "") or None
            src      = str(get("ato_source", "") or "")
            ver      = str(get("version", "") or "")

            rows.append({
                "period": period,
                "lower": lower,
                "upper": upper,             # None means open ended
                "base": base,
                "marginal_rate": rate,
                "effective_from": eff_from,
                "effective_to": eff_to,
                "ato_source": src,
                "version": ver,
            })
    if not rows:
        raise SystemExit("ERROR: No data rows found after header mapping. Check the CSV content.")
    return rows

def validate_monotonicity(rows: List[Dict]) -> int:
    """
    Basic structural checks by (period, effective_from):
      - lower is non-decreasing
      - bands do not overlap (next.lower >= prev.upper + 1 for closed prev.upper)
    """
    issues = 0
    groups = defaultdict(list)
    for r in rows:
        groups[(r["period"], r["effective_from"])].append(r)

    for key, band in groups.items():
        band.sort(key=lambda x: (x["lower"], float("inf") if x["upper"] is None else x["upper"]))

        # monotone lower
        for i in range(1, len(band)):
            if band[i]["lower"] < band[i-1]["lower"]:
                print(f"Issue: non-monotone lower for {key}: {band[i-1]['lower']} -> {band[i]['lower']}")
                issues += 1

        # non-overlap (closed intervals)
        for i in range(1, len(band)):
            prev_u = band[i-1]["upper"]
            cur_l  = band[i]["lower"]
            if prev_u is not None and cur_l <= prev_u:
                print(f"Issue: overlap for {key}: previous upper {prev_u} >= next lower {cur_l}")
                issues += 1

    return issues

def main() -> None:
    global CSV_PATH
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--path",
        type=pathlib.Path,
        default=CSV_PATH,
        help="Path to a banded PAYG CSV (default: data/external/ato/payg/payg_tables_banded.csv)",
    )
    args = ap.parse_args()
    CSV_PATH = args.path

    rows = read_rows()
    issues = validate_monotonicity(rows)
    if issues:
        print(f"\nValidation completed with {issues} issue(s).")
        sys.exit(1)
    print("Validation passed ✅")

if __name__ == "__main__":
    main()
