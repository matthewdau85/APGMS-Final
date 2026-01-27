#!/usr/bin/env bash
set -euo pipefail

# Auto-cd to repo root (assumes this script is created in repo root)
cd "$(dirname "$0")"

echo "==> Repo: $(pwd)"

# Avoid find grouping syntax to prevent \(...\) paste issues.
echo "==> Searching for fix scripts (no grouped find syntax)..."
find . -maxdepth 4 -type f -name "fix-ux-dark-and-white-screen.sh" -print || true
find . -maxdepth 4 -type f -name "fix-white-screen.sh" -print || true
find . -maxdepth 4 -type f -name "fix-ux-*.sh" -print || true
find . -maxdepth 4 -type f -name "*white*screen*.sh" -print || true

TARGET="webapp/fix-ux-dark-and-white-screen.sh"
if [ ! -f "$TARGET" ]; then
  echo "[FAIL] Missing: $TARGET"
  echo "If your script has a different name/path, paste the find output line and I will adapt this runner."
  exit 1
fi

echo "==> Normalizing line endings (CRLF -> LF): $TARGET"
sed -i 's/\r$//' "$TARGET"
chmod +x "$TARGET"

# Patch a common bug: script tries to chmod a non-existent root file.
# We remove any line that literally tries to chmod fix-ux-dark-and-white-screen.sh (without path).
if grep -qE '^\s*chmod\s+\+x\s+fix-ux-dark-and-white-screen\.sh\s*$' "$TARGET"; then
  echo "==> Patching: remove bogus chmod fix-ux-dark-and-white-screen.sh (wrong path)"
  # Delete that exact line
  perl -i -ne 'print unless /^\s*chmod\s+\+x\s+fix-ux-dark-and-white-screen\.sh\s*$/;' "$TARGET"
fi

echo "==> Running fixer: bash $TARGET"
bash "$TARGET"

echo "==> Done."

if [ -f "./dev-webapp.sh" ]; then
  echo "==> To start the webapp dev server from repo root:"
  echo "    bash ./dev-webapp.sh"
else
  echo "==> dev-webapp.sh not found. If pnpm dev fails at repo root, we will add a webapp-specific dev runner."
fi
