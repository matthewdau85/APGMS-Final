#!/usr/bin/env bash
# APGMS workspace repair (WSL-safe, ASCII)
# - Normalise CRLF in scripts
# - Ensure deps per-package (api-gateway, webapp, shared, regwatcher)
# - Force shared prebuild -> prisma generate only (no inline installs)
# - Install, typecheck, build, readiness probe

set -euo pipefail
sed -i 's/\r$//' "$0" 2>/dev/null || true

ROOT="$(pwd)"
LOG="$ROOT/logs/wsl-fix-workspace-v6-$(date -u +%Y%m%dT%H%M%SZ).log"
mkdir -p "$ROOT/logs"
echo "[fix] repo: $ROOT" | tee -a "$LOG"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" | tee -a "$LOG"; exit 2; }; }
need node; need grep; need sed
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then corepack enable || true; corepack prepare pnpm@9 --activate || true; else npm i -g pnpm@9; fi
fi

echo "[fix] normalise CRLF in scripts" | tee -a "$LOG"
if [ -d "$ROOT/scripts" ]; then find "$ROOT/scripts" -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;; fi

node - <<'NODE' "$ROOT" | tee -a "$LOG"
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];

function loadJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
function saveJSON(p, j){ fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8'); }

function ensureDeps(pkgPath, depsToAdd = {}, devDepsToAdd = {}) {
  const j = loadJSON(pkgPath); if(!j) return false;
  j.dependencies = j.dependencies || {};
  j.devDependencies = j.devDependencies || {};
  let touched = false;
  for (const [k,v] of Object.entries(depsToAdd)) {
    if (!j.dependencies[k] && !j.devDependencies[k]) { j.dependencies[k] = v; touched = true; }
  }
  for (const [k,v] of Object.entries(devDepsToAdd)) {
    if (!j.devDependencies[k] && !j.dependencies[k]) { j.devDependencies[k] = v; touched = true; }
  }
  if (touched) { saveJSON(pkgPath, j); console.log("[patched]", path.relative(ROOT, pkgPath)); }
  return touched;
}

function patchScriptOnlyPrismaGenerate(sharedPkgPath) {
  const j = loadJSON(sharedPkgPath); if(!j) return;
  j.scripts = j.scripts || {};
  // Ensure prebuild runs ONLY prisma generate; avoid inline installs
  j.scripts.prebuild = "prisma generate --schema=../infra/prisma/schema.prisma";
  saveJSON(sharedPkgPath, j);
  console.log("[patched]", path.relative(ROOT, sharedPkgPath), "prebuild -> prisma generate");
}

// 1) api-gateway deps
ensureDeps(path.join(ROOT, "services/api-gateway/package.json"), {
  "fastify": "^5.6.1",
  "@fastify/cors": "^11.1.0",
  "zod": "^4.1.12"
});

// 2) webapp dev types
ensureDeps(path.join(ROOT, "webapp/package.json"), {}, {
  "@types/node": "^24.10.1"
});

// 3) shared runtime + prisma deps
ensureDeps(path.join(ROOT, "shared/package.json"), {
  "zod": "^4.1.12",
  "nats": "^2.29.3",
  "argon2": "^0.41.1",
  "@prisma/client": "6.19.0"
}, {
  "prisma": "6.19.0"
});
patchScriptOnlyPrismaGenerate(path.join(ROOT, "shared/package.json"));

// 4) regwatcher needs js-yaml if present
const regwatcherPkg = path.join(ROOT, "packages/regwatcher/package.json");
if (fs.existsSync(regwatcherPkg)) {
  ensureDeps(regwatcherPkg, { "js-yaml": "^4.1.0" }, {});
}

NODE

echo "[fix] install deps (no frozen lockfile)" | tee -a "$LOG"
pnpm install --no-frozen-lockfile | tee -a "$LOG"

echo "[fix] typecheck" | tee -a "$LOG"
set +e
pnpm -r typecheck | tee -a "$LOG"
TC=$?
set -e
if [ $TC -ne 0 ]; then echo "[warn] typecheck issues (see log)"; fi

echo "[fix] build" | tee -a "$LOG"
set +e
pnpm -r build | tee -a "$LOG"
BLD=$?
set -e
if [ $BLD -ne 0 ]; then echo "[warn] build issues (see log)"; fi

echo "[fix] readiness" | tee -a "$LOG"
bash scripts/run-readiness-wsl.sh | tee -a "$LOG" || true

echo "[done] Log: $LOG"
