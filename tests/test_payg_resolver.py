from pathlib import Path
import sys, math

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))  # allow "tools/..." import

from tools.ato_scraper.payg_resolver import withheld

def test_known_points_weekly():
    assert withheld(900,  "weekly")  == 94
    assert withheld(1200, "weekly")  == 183
    assert withheld(2000, "weekly")  == 463

def test_scaling_consistency():
    # Use ratio checks with small tolerance to allow rounding/table artifacts.
    for amount in (500, 800, 1200, 1500, 2000, 3000):
        w = withheld(amount, "weekly")
        f = withheld(amount, "fortnightly")
        m = withheld(amount, "monthly")

        if w <= 0:
            continue

        # Fortnight ~= 2x weekly within 2%
        rf = f / float(w)
        assert abs(rf - 2.0) <= 0.02

        # Monthly ~= (52/12) x weekly within 2%
        rm = m / float(w)
        assert abs(rm - (52.0/12.0)) <= 0.02
