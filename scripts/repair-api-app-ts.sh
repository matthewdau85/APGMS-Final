cd ~/src/APGMS
mkdir -p scripts logs

cat > scripts/repair-api-app-ts.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="logs/repair-api-app-ts-${RUN_ID}.log"

exec > >(tee -a "$LOG") 2>&1

echo "== APGMS: repair-api-app-ts =="
echo "[run_id] $RUN_ID"
echo "[log] $LOG"
echo "[pwd] $(pwd)"
echo

APP="services/api-gateway/src/app.ts"
[ -f "$APP" ] || { echo "[fail] Missing $APP"; exit 2; }

echo "[1/5] Snapshot current app.ts"
cp -a "$APP" "logs/app.ts.pre-repair.${RUN_ID}.bak"
echo "[ok] saved logs/app.ts.pre-repair.${RUN_ID}.bak"
echo

echo "[2/5] Detect common corruption signatures"
# "var __defProp" etc indicates bundled/minified output got written into app.ts
if grep -q "var __defProp" "$APP" 2>/dev/null; then
  echo "[warn] Found bundler/minified signature (var __defProp). Will restore from git."
  NEED_RESTORE=1
else
  NEED_RESTORE=0
fi

# Also detect non-printable characters (excluding tab/newline/carriage-return)
# If this prints anything, file likely has control chars.
if LC_ALL=C grep -n $'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' "$APP" >/dev/null 2>&1; then
  echo "[warn] Found control characters in app.ts. Will restore from git."
  NEED_RESTORE=1
fi
echo

echo "[3/5] Restore app.ts from git if needed (or if TS parse errors likely)"
if [ "$NEED_RESTORE" -eq 1 ]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git restore --source=HEAD -- "$APP" 2>/dev/null || git checkout -- "$APP"
    echo "[ok] Restored $APP from HEAD"
  else
    echo "[fail] Not in a git work tree; cannot auto-restore. Manual restore required."
    echo "       You have a backup at logs/app.ts.pre-repair.${RUN_ID}.bak"
    exit 3
  fi
else
  echo "[ok] No obvious corruption signature detected; not restoring."
fi
echo

echo "[4/5] De-duplicate newRoutes import + registration (safe, idempotent)"
# Keep first matching import, drop duplicates
tmp="$(mktemp)"
awk '
  BEGIN { keepImport=1; keepRegister=1 }
  {
    if ($0 ~ /^import[[:space:]]+newRoutes[[:space:]]+from[[:space:]]+"\.\/routes\/new-routes\.js";[[:space:]]*$/) {
      if (keepImport) { print; keepImport=0 } else { next }
    } else if ($0 ~ /^[[:space:]]*app\.register\(newRoutes\);[[:space:]]*$/) {
      if (keepRegister) { print; keepRegister=0 } else { next }
    } else {
      print
    }
  }
' "$APP" > "$tmp"
mv "$tmp" "$APP"
echo "[ok] Deduped newRoutes lines in $APP"
echo

echo "[5/5] Typecheck API only (fast signal), then full typecheck"
pnpm --filter @apgms/api-gateway typecheck
pnpm -r typecheck
echo
echo "[done] repair complete"
BASH

sed -i 's/\r$//' scripts/repair-api-app-ts.sh
chmod +x scripts/repair-api-app-ts.sh
bash scripts/repair-api-app-ts.sh
