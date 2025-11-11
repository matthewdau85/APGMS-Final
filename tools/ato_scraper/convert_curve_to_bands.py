#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert a PAYG curve (income, withholding_weekly) into tax bands:
period,lower,upper,base,marginal_rate,effective_from,ato_source,version

Detects marginal-rate changes by slope between consecutive points and
emits integer, inclusive, non-overlapping bands. The final band is open-ended.
"""

import argparse, csv, math, pathlib, sys
from typing import List, Dict, Tuple

TOL = 1e-6  # slope equality tolerance (loosened to merge micro-segments)


def read_curve(path: pathlib.Path) -> List[Tuple[float, float]]:
    """Read a curve CSV with columns: income, withholding_weekly (aliases supported)."""
    with path.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        headers = [h.strip().lower() for h in (r.fieldnames or [])]
        if not headers:
            sys.exit("ERROR: no headers in curve CSV.")

        def pick(names):
            for v in names:
                if v in headers:
                    return v
            return None

        inc_key = pick(["income"])
        w_key   = pick(["withholding_weekly", "withholding", "tax"])
        if not inc_key or not w_key:
            sys.exit(f"ERROR: expected columns 'income' and 'withholding_weekly'. Got: {headers}")

        rows: List[Tuple[float, float]] = []
        for row in r:
            if not row:
                continue
            inc_raw = row.get(inc_key, "").strip()
            w_raw   = row.get(w_key, "").strip()
            if inc_raw == "" or w_raw == "":
                continue
            try:
                inc = float(inc_raw)
                w   = float(w_raw)
            except ValueError:
                continue
            rows.append((inc, w))

    rows.sort(key=lambda x: x[0])
    if len(rows) < 2:
        sys.exit("ERROR: need at least 2 points to form bands.")
    return rows


def _slope(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    (x1, y1), (x2, y2) = p1, p2
    dx = x2 - x1
    if dx == 0:
        return math.inf
    return (y2 - y1) / dx


def _close(a: float, b: float, tol: float = TOL) -> bool:
    return abs(a - b) <= tol


def build_bands(points: List[Tuple[float, float]]) -> List[Dict]:
    """
    Build integer, inclusive, non-overlapping bands.

    Strategy:
      - Detect constant-slope segments across consecutive points.
      - Snap lower boundaries to whole dollars (ATO tables are whole dollars).
      - Use inclusive [lower, upper] with next.lower = prev.upper + 1.
      - Last band upper = None (open-ended).
      - Base is tax at band lower (rounded to nearest cent in units).
    """
    bands: List[Dict] = []
    i = 0
    n = len(points)

    while i < n - 1:
        start_i = i
        s = _slope(points[i], points[i + 1])
        j = i + 1
        while j < n - 1:
            s_next = _slope(points[j], points[j + 1])
            if not _close(s_next, s):
                break
            j += 1

        # Segment runs from points[start_i] to points[j]
        seg_lower_raw = points[start_i][0]
        # seg_upper_raw = points[j][0]  # we don't directly use this after snapping

        # Snap to integer dollar boundaries (lower bound)
        seg_lower = int(round(seg_lower_raw))

        base_tax_at_lower = points[start_i][1]

        bands.append({
            "lower": seg_lower,             # integer lower
            "upper": None,                  # set after we know the next lower
            "base": int(round(base_tax_at_lower)),
            "marginal_rate": s
        })
        i = j

    # Fix inclusive integer upper bounds: next.lower = prev.upper + 1
    for k in range(len(bands)):
        if k < len(bands) - 1:
            next_lower = int(bands[k + 1]["lower"])
            bands[k]["upper"] = next_lower - 1
        else:
            bands[k]["upper"] = None  # open-ended

    return bands


def write_bands(
    out_path: pathlib.Path,
    bands: List[Dict],
    period: str,
    effective_from: str,
    ato_source: str,
    version: str = ""
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["period", "lower", "upper", "base", "marginal_rate", "effective_from", "ato_source", "version"])
        for b in bands:
            upper = "" if b["upper"] is None else int(b["upper"])  # blank => open-ended
            w.writerow([
                period,
                int(b["lower"]),
                upper,
                int(b["base"]),
                f"{b['marginal_rate']:.10f}".rstrip("0").rstrip("."),
                effective_from,
                ato_source,
                version
            ])


def main():
    ap = argparse.ArgumentParser(description="Convert PAYG curve CSV to banded table CSV.")
    ap.add_argument("curve_csv", type=pathlib.Path, help="CSV with income,withholding_weekly (normalized curve)")
    ap.add_argument("-o", "--output", type=pathlib.Path, help="Output path for banded CSV")
    ap.add_argument("--period", default="weekly", choices=["weekly", "fortnightly", "monthly"], help="Pay period")
    ap.add_argument("--effective-from", required=True, help="Effective-from date, e.g. 2024-07-01")
    ap.add_argument("--ato-source", required=True, help="Provenance string for manifest/traceability")
    ap.add_argument("--version", default="", help="Optional version tag")
    args = ap.parse_args()

    pts = read_curve(args.curve_csv)
    bands = build_bands(pts)

    out_path = args.output or args.curve_csv.with_name("payg_tables_banded.csv")
    write_bands(out_path, bands, args.period, args.effective_from, args.ato_source, args.version)
    print(f"Wrote bands: {out_path}")


if __name__ == "__main__":
    main()
