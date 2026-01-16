#!/usr/bin/env bash
# WSL-safe workspace repair for APGMS
# - Merge missing deps into package.json files
# - Fix shared prebuild to run prisma directly
# - Install, typecheck, build, test, readiness

# Normalize CRLF if copied from Windows
sed -i 's/\r$//' "$0" 2>/dev/null || true

set -euo pipefail  # (split to be POSIX-safe in non-bash; next line sets pipefail)
set -o pipefail

ROOT="$(pwd)"
LOG="$ROOT/logs/wsl-fix-workspace-$(date -u +%Y%m%dT%H%M%SZ).log"
mkdir -p "$ROOT/logs"
echo "[fix] repo: $ROOT" | tee -a "$LOG"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" | tee -a "$LOG"; exit 2; }; }
need node; need sed; need grep
if ! command -v pnpm >/dev/null 2>&1; then
  need corepack
  echo "[fix] enabling pnpm via corepack" | tee -a "$LOG"
  corepack enable || true
  corepack prepare pnpm@9 --activate || true
fi

# Write a small Node helper to do all JSON edits atomically and safely.
NODE_HELPER="$ROOT/scripts/.pkg-patcher.mjs"
cat > "$NODE_HELPER" <<'NODE'
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function readJson(p){
  try { return JSON.parse(fs.readFileSync(p,'utf8')); }
  catch { return null; }
}
function writeJson(p, obj){
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log(`[patched] ${path.relative(root, p)}`);
}

function ensure(obj, key, def) {
  if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {};
  return obj[key];
}

function addDeps(pkgPath, depMap, dev=false){
  const pkg = readJson(pkgPath);
  if (!pkg) return;
  const bucket = ensure(pkg, dev ? 'devDependencies' : 'dependencies', {});
  let changed = false;
  for (const [k,v] of Object.entries(depMap)){
    if (!bucket[k]) { bucket[k] = v; changed = true; }
  }
  if (changed) writeJson(pkgPath, pkg);
}

function patchSharedPrebuild(sharedPkgPath){
  const pkg = readJson(sharedPkgPath);
  if (!pkg || !pkg.scripts) return;
  const desired = 'prisma generate --schema=../infra/prisma/schema.prisma';
  if (pkg.scripts.prebuild !== desired) {
    pkg.scripts.prebuild = desired;
    writeJson(sharedPkgPath, pkg);
  }
}

function patchTsconfigTypes(tsconfigPath){
  const ts = readJson(tsconfigPath);
  if (!ts) return;
  if (!ts.compilerOptions) ts.compilerOptions = {};
  const types = new Set(Array.isArray(ts.compilerOptions.types) ? ts.compilerOptions.types : []);
  let changed = false;
  for (const t of ['node','jest']) {
    if (!types.has(t)) { types.add(t); changed = true; }
  }
  if (changed) {
    ts.compilerOptions.types = Array.from(types);
    writeJson(tsconfigPath, ts);
  }
}

// 1) shared: add runtime argon2 and local type deps; fix prebuild; ensure ts types
{
  const sharedPkg = path.join(root, 'shared', 'package.json');
  addDeps(sharedPkg, { 'argon2': '^0.41.1' }, false);
  addDeps(sharedPkg, { '@types/node': '^24.10.1', '@types/jest': '^29.5.14' }, true);
  patchSharedPrebuild(sharedPkg);
  const sharedTs = path.join(root, 'shared', 'tsconfig.json');
  if (fs.existsSync(sharedTs)) patchTsconfigTypes(sharedTs);
}

// 2) api-gateway: ensure fastify is declared as a runtime dep
{
  const apiPkg = path.join(root, 'services', 'api-gateway', 'package.json');
  addDeps(apiPkg, { 'fastify': '^5.6.1' }, false);
}

// 3) regwatcher: ensure js-yaml for YAML watchlist parsing
{
  const regPkg = path.join(root, 'packages', 'regwatcher', 'package.json');
  if (fs.existsSync(regPkg)) addDeps(regPkg, { 'js-yaml': '^4.1.0' }, false);
}
NODE

echo "[fix] patching package.json files..." | tee -a "$LOG"
node "$NODE_HELPER" 2>&1 | tee -a "$LOG"

echo "[fix] installing deps (no frozen lockfile)" | tee -a "$LOG"
pnpm install --no-frozen-lockfile 2>&1 | tee -a "$LOG"

echo "[fix] typecheck (workspace)" | tee -a "$LOG"
pnpm -r typecheck 2>&1 | tee -a "$LOG" || echo "[warn] typecheck reported issues (see log)" | tee -a "$LOG"

echo "[fix] build (workspace)" | tee -a "$LOG"
pnpm -r build 2>&1 | tee -a "$LOG" || echo "[warn] build reported issues (see log)" | tee -a "$LOG"

echo "[fix] test (workspace)" | tee -a "$LOG"
pnpm -r test 2>&1 | tee -a "$LOG" || echo "[warn] tests reported failures (see log)" | tee -a "$LOG"

if [ -x "$ROOT/scripts/run-readiness-wsl.sh" ]; then
  echo "[fix] readiness probe" | tee -a "$LOG"
  bash "$ROOT/scripts/run-readiness-wsl.sh" 2>&1 | tee -a "$LOG" || echo "[warn] readiness failed (see log)" | tee -a "$LOG"
else
  echo "[note] scripts/run-readiness-wsl.sh not found or not executable" | tee -a "$LOG"
fi

echo "[done] See log: $LOG"
