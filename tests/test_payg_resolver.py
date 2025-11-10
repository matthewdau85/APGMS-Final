from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))  # allow "tools/..." import

from tools.ato_scraper.payg_resolver import withheld

def test_known_points_weekly():
    assert withheld(900,  "weekly")  == 94
    assert withheld(1200, "weekly")  == 183
    assert withheld(2000, "weekly")  == 463

def test_scaling_consistency():
    for amount in (500, 800, 1200, 1500, 2000, 3000):
        w = withheld(amount, "weekly")
        f = withheld(amount, "fortnightly")
        m = withheld(amount, "monthly")
        assert f in (2*w-1, 2*w, 2*w+1)
        approx_m = round((52.0/12.0)*w)
        assert m in (approx_m-1, approx_m, approx_m+1)
