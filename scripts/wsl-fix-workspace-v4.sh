#!/usr/bin/env bash
# WSL-safe workspace repair for APGMS
# - Normalise line endings on shell scripts
# - Patch package.json for missing runtime/dev deps
# - Fix shared prebuild Prisma usage
# - Ensure TS types present (node, jest)
# - Install, typecheck, build, readiness probe

set -e
set -u
set -o pipefail

ROOT="$(pwd)"
mkdir -p "$ROOT/logs"
LOG="$ROOT/logs/wsl-fix-workspace-$(date -u +%Y%m%dT%H%M%SZ).log"

log(){ printf '[%(%FT%TZ)T] %s\n' -1 "$*" | tee -a "$LOG"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" | tee -a "$LOG"; exit 2; }; }

log "Repo: $ROOT"

# 0) Ensure shell script line endings are LF (avoid $'\r' errors)
if [ -d "$ROOT/scripts" ]; then
  find "$ROOT/scripts" -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;
fi

need node
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    log "Enabling pnpm via corepack"
    corepack enable || true
    corepack prepare pnpm@9 --activate || true
  else
    log "corepack not found; installing pnpm globally"
    npm i -g pnpm@9
  fi
fi

# 1) Node helper to patch package.json & tsconfig.json
PATCHER="$ROOT/scripts/.pkg-patcher.mjs"
cat > "$PATCHER" <<'NODE'
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function readJson(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); console.log(`[patched] ${path.relative(root, p)}`); }
function ensureBucket(pkg, key){ if (!pkg[key] || typeof pkg[key] !== 'object') pkg[key] = {}; return pkg[key]; }

function addDeps(pkgPath, depMap, dev=false){
  const pkg = readJson(pkgPath); if (!pkg) return;
  const bucket = ensureBucket(pkg, dev ? 'devDependencies' : 'dependencies');
  let changed = false;
  for (const [k,v] of Object.entries(depMap)){ if (!bucket[k]) { bucket[k] = v; changed = true; } }
  if (changed) writeJson(pkgPath, pkg);
}

function setScript(pkgPath, scriptName, value){
  const pkg = readJson(pkgPath); if (!pkg) return;
  if (!pkg.scripts) pkg.scripts = {};
  if (pkg.scripts[scriptName] !== value) { pkg.scripts[scriptName] = value; writeJson(pkgPath, pkg); }
}

function ensureTsTypes(tsconfigPath, types){
  const ts = readJson(tsconfigPath); if (!ts) return;
  if (!ts.compilerOptions) ts.compilerOptions = {};
  const cur = new Set(Array.isArray(ts.compilerOptions.types) ? ts.compilerOptions.types : []);
  let changed = false;
  for (const t of types){ if (!cur.has(t)) { cur.add(t); changed = true; } }
  if (changed) { ts.compilerOptions.types = Array.from(cur); writeJson(tsconfigPath, ts); }
}

// shared: runtime argon2; dev types; prisma prebuild; TS types
{
  const sharedPkg = path.join(root, 'shared', 'package.json');
  if (fs.existsSync(sharedPkg)) {
    addDeps(sharedPkg, { 'argon2': '^0.41.1' }, false);
    addDeps(sharedPkg, { '@types/node': '^24.10.1', '@types/jest': '^29.5.14' }, true);
    setScript(sharedPkg, 'prebuild', 'prisma generate --schema=../infra/prisma/schema.prisma');
  }
  const sharedTs = path.join(root, 'shared', 'tsconfig.json');
  if (fs.existsSync(sharedTs)) ensureTsTypes(sharedTs, ['node','jest']);
}

// api-gateway: declare fastify runtime
{
  const apiPkg = path.join(root, 'services', 'api-gateway', 'package.json');
  if (fs.existsSync(apiPkg)) addDeps(apiPkg, { 'fastify': '^5.6.1' }, false);
}

// regwatcher: js-yaml for YAML parsing (if present)
{
  const regPkg = path.join(root, 'packages', 'regwatcher', 'package.json');
  if (fs.existsSync(regPkg)) addDeps(regPkg, { 'js-yaml': '^4.1.0' }, false);
}
NODE

log "Patching package.json/tsconfig"
node "$PATCHER" 2>&1 | tee -a "$LOG" || true

# 2) Install deps (allow lock drift)
log "Installing deps (no frozen lockfile)"
pnpm install --no-frozen-lockfile 2>&1 | tee -a "$LOG" || true

# 3) Typecheck / build (best-effort; do not fail the script)
log "Typecheck (workspace)"
pnpm -r typecheck 2>&1 | tee -a "$LOG" || log "[warn] typecheck issues (see log)"

log "Build (workspace)"
pnpm -r build 2>&1 | tee -a "$LOG" || log "[warn] build issues (see log)"

# 4) Readiness probe (optional)
if [ -x "$ROOT/scripts/run-readiness-wsl.sh" ]; then
  log "Readiness probe"
  bash "$ROOT/scripts/run-readiness-wsl.sh" 2>&1 | tee -a "$LOG" || log "[warn] readiness failed (see log)"
else
  log "Note: scripts/run-readiness-wsl.sh not found or not executable"
fi

log "Done. Log: $LOG"
