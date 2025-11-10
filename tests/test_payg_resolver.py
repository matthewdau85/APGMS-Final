from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))  # allow "tools/..." import

from tools.ato_scraper.payg_resolver import withheld

RATIO_M = 52.0/12.0

def test_known_points_weekly():
    assert withheld(900,  "weekly")  == 94
    assert withheld(1200, "weekly")  == 183
    assert withheld(2000, "weekly")  == 463

def test_scaling_consistency():
    # Allow small rounding and table artifacts: use 2% RELATIVE tolerance
    for amount in (500, 800, 1200, 1500, 2000, 3000):
        w = withheld(amount, "weekly")
        f = withheld(amount, "fortnightly")
        m = withheld(amount, "monthly")

        if w <= 0:
            continue

        # Fortnight ~= 2x weekly within 2% relative error
        rf = f / float(w)
        assert abs(rf - 2.0)/2.0 <= 0.02

        # Monthly ~= (52/12) x weekly within 2% relative error
        rm = m / float(w)
        assert abs(rm - RATIO_M)/RATIO_M <= 0.02
