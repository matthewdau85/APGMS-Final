#!/usr/bin/env bash
set -u -o pipefail

cd ~/src/APGMS

ts="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="artifacts/debug-api-missing-mods-${ts}.log"
mkdir -p artifacts

# Log to file + console
exec > >(tee -a "$LOG") 2>&1

fail_count=0

run() {
  # Usage: run "description" command...
  local desc="$1"
  shift
  echo
  echo "==> $desc"
  echo "+ $*"
  if "$@"; then
    echo "[OK] $desc"
  else
    rc=$?
    echo "[FAIL rc=$rc] $desc"
    fail_count=$((fail_count + 1))
  fi
}

echo "Log: $LOG"

run "Context: git rev-parse" git rev-parse --short HEAD
run "Context: node -v" node -v
run "Context: pnpm -v" pnpm -v

API_DIR="services/api-gateway"
SRC_DIR="$API_DIR/src"

echo
echo "== Check missing modules referenced by $SRC_DIR/app.ts =="

run "Find likely files anywhere under src/ (maxdepth 6)" \
  find "$SRC_DIR" -maxdepth 6 -type f \( \
    -name "cors-allowlist.*" -o \
    -name "prototype-paths.*" -o \
    -name "evidence-pack.*" \
  \) -print

echo
echo "-- If none printed above, check if git knows about them (tracked history) --"
for p in \
  "$SRC_DIR/plugins/cors-allowlist.ts" \
  "$SRC_DIR/plugins/cors-allowlist.js" \
  "$SRC_DIR/lib/prototype-paths.ts" \
  "$SRC_DIR/lib/prototype-paths.js" \
  "$SRC_DIR/routes/evidence-pack.ts" \
  "$SRC_DIR/routes/evidence-pack.js"
do
  if git ls-files --error-unmatch "$p" >/dev/null 2>&1; then
    echo "TRACKED: $p"
  else
    echo "NOT TRACKED (or deleted): $p"
  fi
done

echo
echo "== Show the imports in app.ts that are breaking =="
if [[ -f "$SRC_DIR/app.ts" ]]; then
  run "Print $SRC_DIR/app.ts (lines 1-160)" bash -lc "nl -ba \"$SRC_DIR/app.ts\" | sed -n '1,160p'"
else
  echo "[WARN] Missing: $SRC_DIR/app.ts"
  fail_count=$((fail_count + 1))
fi

echo
echo "== If files existed before, try restoring them from origin/main =="

run "git fetch origin main" git fetch origin main --quiet

restore_one() {
  local path="$1"
  if git cat-file -e "origin/main:$path" 2>/dev/null; then
    echo "Restoring $path from origin/main"
    if git checkout origin/main -- "$path"; then
      echo "[OK] Restored $path"
    else
      echo "[FAIL] Could not restore $path"
      fail_count=$((fail_count + 1))
    fi
  else
    echo "[MISS] Not present in origin/main: $path"
  fi
}

restore_one "$SRC_DIR/plugins/cors-allowlist.ts"
restore_one "$SRC_DIR/lib/prototype-paths.ts"
restore_one "$SRC_DIR/routes/evidence-pack.ts"

echo
echo "== Re-run api-gateway typecheck to see the next concrete failures =="
run "pnpm --filter @apgms/api-gateway typecheck" pnpm --filter @apgms/api-gateway typecheck

echo
echo "== Re-run api-gateway tests (module-not-found should be gone if restore worked) =="
run "pnpm --filter @apgms/api-gateway test -- --runInBand" pnpm --filter @apgms/api-gateway test -- --runInBand

echo
echo "========================"
echo "Done. Failures: $fail_count"
echo "Log saved to: $LOG"
echo "========================"

# Keep the window open if interactive
if [[ -t 0 ]]; then
  read -r -p "Press Enter to exit..." _
fi

# Return success only if everything succeeded (useful in CI)
if [[ "$fail_count" -ne 0 ]]; then
  exit 1
fi
