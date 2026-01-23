import sys
from pathlib import Path

if len(sys.argv) != 2:
    print("usage: write_text.py <path>", file=sys.stderr)
    sys.exit(2)

path = Path(sys.argv[1])
text = sys.stdin.read()
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(text, encoding="utf-8", newline="\n")
