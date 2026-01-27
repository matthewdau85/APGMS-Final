cd ~/src/APGMS

python3 - <<'PY'
from pathlib import Path

p = Path("scripts/ux-doctor.sh")
p.parent.mkdir(parents=True, exist_ok=True)

script = r"""#!/usr/bin/env bash
set -euo pipefail

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { echo "$(ts) $*"; }
warn() { echo "$(ts) [WARN] $*"; }
err() { echo "$(ts) [FAIL] $*"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBAPP_DIR="$ROOT_DIR/webapp"

log "== ux-doctor =="
log "ROOT_DIR=$ROOT_DIR"
log "WEBAPP_DIR=$WEBAPP_DIR"

cd "$ROOT_DIR" || exit 1

git_sha="$(git rev-parse --short HEAD 2>/dev/null || echo "UNKNOWN")"
node_v="$(node -v 2>/dev/null || echo "MISSING")"
pnpm_v="$(pnpm -v 2>/dev/null || echo "MISSING")"
log "git_sha=$git_sha"
log "node=$node_v"
log "pnpm=$pnpm_v"
echo

log "== Port checks (Vite usually 5173+; API usually 3000) =="
if command -v lsof >/dev/null 2>&1; then
  for port in 5173 5174 5175 5176 5177 5178 5179 5180 3000; do
    pids="$(lsof -ti tcp:${port} 2>/dev/null || true)"
    if [ -n "${pids}" ]; then
      warn "port ${port} in use by PID(s): ${pids}"
      warn "       kill: kill -9 ${pids}"
    else
      log "[OK] port ${port} free"
    fi
  done
else
  warn "lsof not found; skipping port/PID detection"
fi
echo

log "== Host DNS + network checks =="
dns_ok=1
for host in registry.npmjs.org pypi.org deb.debian.org; do
  if getent hosts "$host" >/dev/null 2>&1; then
    log "[OK] DNS resolves: $host"
  else
    err "DNS does NOT resolve: $host"
    dns_ok=0
  fi
done

probe() {
  local name="$1"
  local url="$2"
  local out
  out="$(curl -sS -o /dev/null -m 12 -I \
    -w "http_code=%{http_code} time_namelookup=%{time_namelookup}s time_connect=%{time_connect}s time_appconnect=%{time_appconnect}s time_total=%{time_total}s" \
    "$url" 2>/dev/null || true)"
  if echo "$out" | grep -q "http_code=200"; then
    log "[OK] $name $out"
  else
    warn "$name $out"
  fi
}

probe "npm registry" "https://registry.npmjs.org/"
probe "pypi simple" "https://pypi.org/simple/"
probe "debian repo" "https://deb.debian.org/"

echo
log "== Rough throughput check (host) =="
# 4-6MB-ish test file (fastly). If blocked, you'll just see WARN.
t_out="$(curl -sS -o /dev/null -m 20 \
  -w "http_code=%{http_code} time_total=%{time_total}s speed_download=%{speed_download}B/s size_download=%{size_download}B" \
  "https://speed.hetzner.de/5MB.bin" 2>/dev/null || true)"
if echo "$t_out" | grep -q "http_code=200"; then
  log "[OK] host throughput $t_out"
else
  warn "host throughput $t_out"
fi

echo
log "Speed guidance (rule-of-thumb):"
log "- If time_namelookup > 1.0s often or DNS times out: installs/builds will appear to 'hang'."
log "- If speed_download is consistently < ~200000 B/s (~0.2 MB/s): pnpm/pip/apt will feel brutal."
log "- For 'prompt' builds, you want stable DNS + low packet loss more than huge Mbps."
echo

log "== Optional: Container DNS + network check (node base image) =="
if command -v docker >/dev/null 2>&1; then
  docker run --rm node:20-bookworm-slim sh -lc '
    set -e
    (command -v curl >/dev/null 2>&1) || (apt-get update >/dev/null 2>&1 && apt-get install -y --no-install-recommends ca-certificates curl >/dev/null 2>&1) || true
    getent hosts registry.npmjs.org >/dev/null 2>&1 && echo "[OK] container DNS registry.npmjs.org" || echo "[FAIL] container DNS registry.npmjs.org"
    curl -I -m 12 https://registry.npmjs.org/ >/dev/null 2>&1 && echo "[OK] container curl registry.npmjs.org" || echo "[FAIL] container curl registry.npmjs.org"
  ' || warn "docker container probe failed"
else
  warn "docker not found; skipping container probes"
fi
echo

log "== Webapp readability/permissions check =="
if [ ! -d "$WEBAPP_DIR" ]; then
  err "webapp/ not found at $WEBAPP_DIR"
  exit 1
fi

# Flag unreadable files under webapp/src (common when permissions got mangled)
unreadable="$(find "$WEBAPP_DIR/src" -type f ! -readable 2>/dev/null | sed -n '1,50p' || true)"
if [ -n "$unreadable" ]; then
  err "Found unreadable file(s) under webapp/src (first 50 shown):"
  echo "$unreadable" | sed 's/^/  - /'
  echo
  err "Fix with:"
  echo "  chmod -R u+rwX \"$WEBAPP_DIR/src\""
  echo
fi
echo

log "== CSS import ordering + BOM/hidden-byte checks =="
# We focus on CSS because your current hard error is PostCSS import ordering.
css_files="$(find "$WEBAPP_DIR/src" -type f -name "*.css" 2>/dev/null || true)"
if [ -z "$css_files" ]; then
  warn "No CSS files found under webapp/src"
  exit 0
fi

# 1) List empty CSS files (not fatal, but suspicious)
while IFS= read -r f; do
  if [ ! -s "$f" ]; then
    warn "empty CSS file: ${f#$ROOT_DIR/}"
  fi
done <<<"$css_files"
echo

# 2) Detect BOM at start of file (EF BB BF)
bom_hits=0
while IFS= read -r f; do
  # read first 3 bytes safely
  b="$(python3 - <<PY
import sys
p=sys.argv[1]
with open(p,'rb') as fh:
  d=fh.read(3)
print(d.hex())
PY
"$f" 2>/dev/null || echo "")"
  if [ "$b" = "efbbbf" ]; then
    warn "BOM detected: ${f#$ROOT_DIR/}"
    bom_hits=$((bom_hits+1))
  fi
done <<<"$css_files"

if [ "$bom_hits" -gt 0 ]; then
  echo
  warn "BOM can break @import ordering in some pipelines. Fix with:"
  echo "  # removes UTF-8 BOM if present"
  echo "  find \"$WEBAPP_DIR/src\" -name \"*.css\" -print0 | xargs -0 -I{} sed -i '1s/^\\xEF\\xBB\\xBF//' \"{}\""
fi
echo

# 3) Detect any non-@import statement appearing before the first @import in each file.
# This catches the classic cause of: "@import must precede all other statements"
bad_order=0
while IFS= read -r f; do
  rel="${f#$ROOT_DIR/}"
  # Skip unreadable
  if [ ! -r "$f" ]; then
    continue
  fi
  python3 - "$f" "$rel" <<'PY' || bad_order=$((bad_order+1))
import sys, re
path = sys.argv[1]
rel  = sys.argv[2]
try:
  txt = open(path, "rb").read()
except Exception as e:
  sys.exit(0)

# decode tolerantly so we can inspect; keep bytes for BOM already handled above
s = txt.decode("utf-8", errors="replace")

lines = s.splitlines()
# Find first @import
first_import = None
for i, line in enumerate(lines, start=1):
  if re.match(r'^\s*@import\b', line):
    first_import = i
    break

# If no @import, nothing to check here.
if first_import is None:
  sys.exit(0)

# Look for any "real statement" before first @import.
# Allow: blank lines. Allow: @charset only. Everything else is suspicious.
for i in range(1, first_import):
  line = lines[i-1]
  if re.match(r'^\s*$', line):
    continue
  if re.match(r'^\s*@charset\b', line):
    continue
  # comments can be treated as statements in some processors; flag them too.
  print(f"[FAIL] {rel}:{i}: content appears before first @import -> {line[:120]}")
  print("       This can trigger: '@import must precede all other statements'.")
  sys.exit(1)
PY
done <<<"$css_files"

if [ "$bad_order" -gt 0 ]; then
  echo
  err "Import-order violations detected above."
  err "Fix: ensure each CSS file has @import lines (and nothing else) at the very top."
  err "If you need comments, place them AFTER imports to be safe."
else
  log "[OK] No 'content before first @import' violations detected."
fi
echo

log "== CSS import graph (quick) =="
# show lines containing @import in src/styles and src/_figma/styles (if present)
for d in "$WEBAPP_DIR/src/styles" "$WEBAPP_DIR/src/_figma/styles"; do
  if [ -d "$d" ]; then
    find "$d" -type f -name "*.css" -print0 | xargs -0 -I{} sh -lc '
      f="$1"
      rel="${f#'"$ROOT_DIR"'/}"
      awk "/@import/ { printf(\"%s:%d:%s\\n\", rel, NR, \$0) }" rel="$rel" "$f"
    ' sh {} 2>/dev/null || true
  fi
done

echo
log "== Next actions =="
log "1) Re-run the exact failing command to capture the first error line:"
log "   cd $WEBAPP_DIR && pnpm dev"
log "2) If it still says '@import must precede...', it will name the exact CSS file + line."
log "3) If unreadable files were reported, fix permissions first:"
log "   chmod -R u+rwX \"$WEBAPP_DIR/src\""
"""
p.write_text(script, encoding="utf-8", newline="\n")
print("[OK] wrote scripts/ux-doctor.sh")
PY

chmod +x scripts/ux-doctor.sh
bash scripts/ux-doctor.sh
