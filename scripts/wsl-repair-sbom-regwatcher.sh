#!/usr/bin/env bash
# WSL-safe, ASCII, single-run repair for CycloneDX & regwatcher
# - Normalises CRLF in tracked files
# - Rewrites cyclonedx-bom -> cyclonedx-npm (tracked files only)
# - Updates all package.json via Node (add @cyclonedx/cyclonedx-npm, remove cyclonedx-bom, fix scripts)
# - Writes a regwatcher runner shim
# - Installs deps and runs typecheck/build/tests
set -euo pipefail
sed -i 's/\r$//' "$0" 2>/dev/null || true

log(){ printf '[%(%FT%TZ)T] %s\n' -1 "$*" | tee -a "$LOG"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" | tee -a "$LOG"; exit 2; }; }

ROOT="$(pwd)"
LOG="$ROOT/logs/repair-$(date -u +%Y%m%dT%H%M%SZ).log"
touch "$LOG"

log "Repo: $ROOT"
need git
need node
need grep
need xargs
need sed
if ! command -v pnpm >/dev/null 2>&1; then
  need corepack
  log "Enabling pnpm via corepack"
  corepack enable || true
  corepack prepare pnpm@9 --activate
fi

# 0) Limit all ops strictly to tracked files (avoids node_modules)
log "Normalising CRLF on all tracked text files"
git ls-files -z | xargs -0 -I{} sed -i 's/\r$//' "{}" 2>/dev/null || true

# 1) Replace 'cyclonedx-bom' -> 'cyclonedx-npm' in tracked files (non-JSON safe; JSON handled later anyway)
log "Replacing 'cyclonedx-bom' -> 'cyclonedx-npm' across tracked files"
git ls-files -z | xargs -0 -n1 -I{} sh -c '
  f="{}"
  # Skip binaries by extension heuristics
  case "$f" in
    *.png|*.jpg|*.jpeg|*.webp|*.gif|*.pdf|*.ico|*.woff|*.woff2|*.ttf|*.eot) exit 0 ;;
  esac
  if grep -q "cyclonedx-bom" "$f" 2>/dev/null; then
    sed -i "s/\bcyclonedx-bom\b/cyclonedx-npm/g" "$f"
    echo "[rewrite] $f"
  fi
' | tee -a "$LOG" || true

# 2) Update all package.json via Node (add @cyclonedx/cyclonedx-npm ^4.1.2, remove cyclonedx-bom, fix scripts)
TMPDIR="$(mktemp -d)"
PKG_UPD="$TMPDIR/update-pkg.mjs"
cat > "$PKG_UPD" <<'JS'
import fs from 'fs';

const path = process.argv[2];
const text = fs.readFileSync(path, 'utf8');
let pkg;
try { pkg = JSON.parse(text); } catch (e) {
  console.error(`[skip-invalid-json] ${path}`);
  process.exit(0);
}

let changed = false;

// Ensure devDependencies exists
pkg.devDependencies = pkg.devDependencies || {};

// Remove legacy 'cyclonedx-bom' from both deps blocks
for (const block of ['dependencies','devDependencies']) {
  if (pkg[block] && Object.prototype.hasOwnProperty.call(pkg[block], 'cyclonedx-bom')) {
    delete pkg[block]['cyclonedx-bom'];
    changed = true;
  }
}

// Add modern CLI
const wantName = '@cyclonedx/cyclonedx-npm';
const wantVer  = '^4.1.2';
if (!pkg.devDependencies[wantName]) {
  pkg.devDependencies[wantName] = wantVer;
  changed = true;
}

// Rewrite scripts to use cyclonedx-npm
if (pkg.scripts) {
  for (const [k, v] of Object.entries(pkg.scripts)) {
    if (typeof v === 'string' && v.includes('cyclonedx-bom')) {
      const nv = v.replace(/\bcyclonedx-bom\b/g, 'cyclonedx-npm');
      if (nv !== v) {
        pkg.scripts[k] = nv;
        changed = true;
      }
    }
  }
}

if (changed) {
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`[pkg-updated] ${path}`);
} else {
  console.log(`[pkg-ok] ${path}`);
}
JS

log "Rewriting package.json blocks via Node"
git ls-files -z -- '**/package.json' | xargs -0 -n1 node "$PKG_UPD" | tee -a "$LOG"

# 3) Drop-in regwatcher runner shim (stable entrypoint)
log "Writing regwatcher runner shim at scripts/regwatcher-run.sh"
mkdir -p scripts
cat > scripts/regwatcher-run.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
# Resolve a tracked regwatcher bin and execute with Node
found="$(git ls-files | grep -E '/regwatcher/.*/bin/run\.mjs$' | head -n1 || true)"
if [ -z "${found:-}" ]; then
  echo "regwatcher bin not found in tracked files (expected .../regwatcher/.../bin/run.mjs)" >&2
  exit 2
fi
exec node "$found" "$@"
SH
chmod +x scripts/regwatcher-run.sh

# 4) Install deps and run common scripts repo-wide
log "Installing dependencies with pnpm (workspace recursive)"
pnpm install | tee -a "$LOG"

log "Running typecheck (if present) across workspace"
pnpm -r -w --if-present typecheck | tee -a "$LOG" || true

log "Running build (if present) across workspace"
pnpm -r -w --if-present build | tee -a "$LOG" || true

log "Running tests (if present) across workspace"
pnpm -r -w --if-present test | tee -a "$LOG" || true

# 5) Optional readiness runner if you have one
if [ -x scripts/run-readiness-wsl.sh ]; then
  log "Running scripts/run-readiness-wsl.sh"
  bash scripts/run-readiness-wsl.sh | tee -a "$LOG" || true
fi

log "Done. See log: $LOG"
