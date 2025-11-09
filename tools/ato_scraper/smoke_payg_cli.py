import sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from tools.ato_scraper.payg_resolver import withheld

def main():
    levels = [200,300,400,500,600,700,800,900,1000,1200,1500,2000,2500,3000,3500,4000]
    for a in levels:
        print(f"{a:4d} -> W:{withheld(a,'weekly'):4.0f}  F:{withheld(a,'fortnightly'):4.0f}  M:{withheld(a,'monthly'):4.0f}")

if __name__ == "__main__":
    main()
