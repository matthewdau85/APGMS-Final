#!/usr/bin/env python3
import csv, pathlib, sys
from tools.ato_scraper.payg_resolver import load_banded_table, compute_withholding

BANDS = pathlib.Path("data/external/ato/payg/payg_tables_banded.csv")
CASES = pathlib.Path("tools/fixtures/payg_spotchecks.csv")

def main():
    bands = load_banded_table(BANDS)  # expects columns: period,lower,upper,base,marginal_rate,effective_from,...
    fails = 0
    with CASES.open(newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            period = row["period"].strip().lower()
            income = float(row["income"])
            eff    = row["effective_from"].strip()
            expected = int(row["expected"])
            got = int(round(compute_withholding(bands, period, income, effective_from=eff)))
            if got != expected:
                print(f"FAIL {period} {income} @ {eff}: expected {expected}, got {got}")
                fails += 1
    if fails:
        print(f"\n{fails} spot case(s) failed.")
        sys.exit(1)
    print("Spot checks passed ✅")

if __name__ == "__main__":
    main()
