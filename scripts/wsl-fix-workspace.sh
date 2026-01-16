#!/usr/bin/env bash
# WSL-safe workspace repair for remaining issues:
# - Add missing types to shared
# - Add argon2 to shared
# - Fix shared prebuild to use prisma without self-install
# - Ensure api-gateway declares its runtime deps
# - Ensure regwatcher depends on js-yaml
# - Install, typecheck, build, test, and readiness probe

set -euo pipefail
sed -i 's/\r$//' "$0" 2>/dev/null || true
ROOT="$(pwd)"
LOG="$ROOT/logs/wsl-fix-workspace-$(date -u +%Y%m%dT%H%M%SZ).log"
echo "[fix] repo: $ROOT" | tee -a "$LOG"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" | tee -a "$LOG"; exit 2; }; }
need node; need grep; need sed
if ! command -v pnpm >/dev/null 2>&1; then corepack enable || true; corepack prepare pnpm@9 --activate; fi

update_pkg_json() {
  local file="$1"
  node - "$file" <<'NODE'
import fs from 'fs';
const p = process.argv[1];
let j; try { j = JSON.parse(fs.readFileSync(p,'utf8')); } catch { process.exit(0); }
let changed=false;

// Helper to ensure a dep entry
function ensure(obj, name, ver){ if(!obj[name]){ obj[name]=ver; changed=true; } }
// Helper to set/replace a script if it contains a needle or is missing
function scriptReplace(needleRegex, newValue){
  j.scripts = j.scripts || {};
  const has = Object.values(j.scripts).some(v => typeof v==='string' && new RegExp(needleRegex).test(v));
  if (has) {
    for (const k of Object.keys(j.scripts)) {
      if (new RegExp(needleRegex).test(j.scripts[k])) { j.scripts[k]=newValue; changed=true; }
    }
  }
}

// 1) shared: types + argon2 + prebuild fix
if ((j.name||'').includes('shared')) {
  j.devDependencies = j.devDependencies || {};
  j.dependencies = j.dependencies || {};
  ensure(j.devDependencies, '@types/node', '^24.10.1');
  ensure(j.devDependencies, '@types/jest', '^29.5.14');
  ensure(j.dependencies, 'argon2', '^0.41.1');

  // If prebuild references ensure-linux or pnpm add, replace with stable prisma generate
  j.scripts = j.scripts || {};
  if (typeof j.scripts.prebuild === 'string' &&
      /(ensure-linux|pnpm\s+add\s+prisma)/.test(j.scripts.prebuild)) {
    j.scripts.prebuild = 'pnpm exec prisma generate --schema=../infra/prisma/schema.prisma';
    changed = true;
  }
}

// 2) api-gateway: runtime deps must be declared here
if ((j.name||'').includes('api-gateway')) {
  j.dependencies = j.dependencies || {};
  j.devDependencies = j.devDependencies || {};
  ensure(j.dependencies, 'fastify', '^5.6.1');
  ensure(j.dependencies, '@fastify/cors', '^11.1.0');
  ensure(j.dependencies, 'zod', '^4.1.12');
  ensure(j.dependencies, '@prisma/client', '^6.19.0');
  ensure(j.dependencies, 'uuid', '^10.0.0');
  ensure(j.dependencies, 'nats', '^2.29.3');
}

// 3) regwatcher: ensure js-yaml
if ((j.name||'').includes('regwatcher')) {
  j.dependencies = j.dependencies || {};
  ensure(j.dependencies, 'js-yaml', '^4.1.0');
}

if (changed) fs.writeFileSync(p, JSON.stringify(j, null, 2)+'\n', 'utf8');
console.log(changed ? `[updated] ${p}` : `[ok] ${p}`);
NODE
}

echo "[fix] updating package.json files" | tee -a "$LOG"
# Only touch tracked package.json files
git ls-files -z -- '**/package.json' | xargs -0 -n1 bash -c 'update_pkg_json "$0"' | tee -a "$LOG"

echo "[fix] installing deps" | tee -a "$LOG"
pnpm install | tee -a "$LOG"

echo "[fix] typecheck all" | tee -a "$LOG"
pnpm -r -w --if-present typecheck | tee -a "$LOG" || true

echo "[fix] build all" | tee -a "$LOG"
pnpm -r -w --if-present build | tee -a "$LOG" || true

echo "[fix] test all" | tee -a "$LOG"
pnpm -r -w --if-present test | tee -a "$LOG" || true

# Optional: readiness probe if you have it
if [ -x scripts/run-readiness-wsl.sh ]; then
  echo "[fix] readiness probe" | tee -a "$LOG"
  bash scripts/run-readiness-wsl.sh | tee -a "$LOG" || true
fi

echo "[fix] done. log: $LOG"
