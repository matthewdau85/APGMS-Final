import sys
sys.path.insert(0, r"C:\loat-poc")
from tools.ato_scraper.payg_resolver import withheld

def test_known_points_weekly():
    # spot-check a few stable grid points
    assert withheld(900, "weekly")   == 94
    assert withheld(1200, "weekly")  == 183
    assert withheld(2000, "weekly")  == 463

def test_scaling_consistency():
    # fortnight ? 2? weekly; monthly ? 4.333? weekly (integer-rounded tables)
    w = withheld(1500, "weekly")
    assert withheld(1500, "fortnightly") in (2*w, 2*w+1, 2*w-1)
    assert withheld(1500, "monthly") in (round(4.333*w)-1, round(4.333*w), round(4.333*w)+1)
def test_edges_rounding_does_not_decrease():
    # small increments don't make withholding drop
    a = withheld(1080, "weekly")
    b = withheld(1081, "weekly")
    assert b >= a
def test_edges_rounding_does_not_decrease():
    # small increments don't make withholding drop
    a = withheld(1080, "weekly")
    b = withheld(1081, "weekly")
    assert b >= a
