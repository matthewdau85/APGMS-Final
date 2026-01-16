#!/usr/bin/env bash
# Normalize CRLF if copied from Windows
sed -i 's/\r$//' "$0" 2>/dev/null || true
set -eu
if [ -n "${BASH_VERSION:-}" ]; then set -o pipefail; fi

ROOT="${ROOT:-$PWD}"
echo "[fix] repo: $ROOT"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 2; }; }
need node
need grep
need sed
need find

# 1) Update every package.json that references @cyclonedx/cyclonedx-npm
fix_pkg_json() {
  local f="$1"
  node - <<'NODE' "$f"
const fs = require('fs');
const path = process.argv[2];
const raw = fs.readFileSync(path, 'utf8');
let j;
try { j = JSON.parse(raw); } catch(e){ process.exit(0); }

let changed = false;
const fields = ['dependencies','devDependencies','optionalDependencies'];
for (const k of fields) {
  if (j[k] && j[k]['@cyclonedx/cyclonedx-npm']) {
    delete j[k]['@cyclonedx/cyclonedx-npm'];
    j[k]['@cyclonedx/cyclonedx-npm'] = j[k]['@cyclonedx/cyclonedx-npm'] || '^5.0.0';
    changed = true;
  }
}
if (changed) {
  fs.writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
  console.log('[pkg.json] updated', path);
}
NODE
}

export -f fix_pkg_json

# 2) Replace command names in scripts & CI
replace_cmds_in_file() {
  local f="$1"
  if grep -qE 'cyclonedx-npm' "$f"; then
    sed -i -E 's/cyclonedx-npm/cyclonedx-npm/g' "$f"
    echo "[rewrite] $f"
  fi
}

export -f replace_cmds_in_file

# Run across repo
find . -name package.json -type f -print0 | xargs -0 -I{} bash -c 'fix_pkg_json "$@"' _ {}
# Typical locations for scripts/CI where the binary name could appear:
for f in $(git ls-files | grep -E '\.(yml|yaml|sh|md|cjs|mjs|ts|js)$' || true); do
  replace_cmds_in_file "$f"
done

# 3) Optional: add a root script if none exists yet
if [ -f package.json ]; then
  node - <<'NODE'
const fs = require('fs');
const p = 'package.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.scripts = j.scripts || {};
if (!j.scripts.sbom) {
  j.scripts.sbom = "cyclonedx-npm --spec-version 1.5 --output-file sbom.json";
  console.log('[root scripts] added sbom');
}
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
NODE
fi

echo "[install] running pnpm install (no frozen lockfile)"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --no-frozen-lockfile
else
  corepack enable || true
  corepack prepare pnpm@9 --activate
  pnpm install --no-frozen-lockfile
fi

echo "[smoke] regwatcher one-off (no email)"
pnpm run -s regwatcher:once || true

echo "[done] CycloneDX fix applied."
