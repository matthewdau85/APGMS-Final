#!/usr/bin/env bash
# WSL-safe, ASCII, single-run repair
sed -i 's/\r$//' "$0" 2>/dev/null || true
set -eu; [ -n "${BASH_VERSION:-}" ] && set -o pipefail

log(){ printf '%s %s\n' "[$(date -u +%FT%TZ)]" "$*"; }

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 2; }; }

need sed; need grep; need find
if ! command -v pnpm >/dev/null 2>&1; then
  need corepack
  corepack enable || true
  corepack prepare pnpm@9 --activate
fi

log "Repo: $PWD"

# 0) Normalize CRLF across this repo (harmless; avoids weird parse errors)
find . -type f -name "*.sh" -o -name "*.mjs" -o -name "*.js" -o -name "package.json" \
 | while read -r f; do sed -i 's/\r$//' "$f" 2>/dev/null || true; done

# 1) Replace any use of 'cyclonedx-npm' with 'cyclonedx-npm' in scripts/CI
log "Replacing cyclonedx-npm -> cyclonedx-npm in source/CI"
find . -type f -regextype posix-extended -regex '.*\.(ya?ml|yml|sh|md|cjs|mjs|js|ts)$' \
 | while read -r f; do
     if grep -q 'cyclonedx-npm' "$f"; then
       sed -i 's/cyclonedx-npm/cyclonedx-npm/g' "$f"
       log "[rewrite] $f"
     fi
   done

# 2) Fix any package.json that pins @cyclonedx/cyclonedx-npm to ^5.x
log "Rewriting package.json entries for @cyclonedx/cyclonedx-npm => ^4.1.2"
fix_pkg(){
  local pj="$1"
  # Replace any version string for the package to ^4.1.2
  sed -i -E 's#"@cyclonedx/cyclonedx-npm"[[:space:]]*:[[:space:]]*"[^"]*"#"@cyclonedx/cyclonedx-npm": "^4.1.2"#g' "$pj"
  # Remove any @cyclonedx/cyclonedx-npm entry entirely
  sed -i -E '/"@cyclonedx\/cyclonedx-npm"[[:space:]]*:/d' "$pj"
  # Ensure a scripts.sbom exists (idempotent add if missing)
  if ! grep -q '"sbom"' "$pj"; then
    sed -i -E 's#"scripts":[[:space:]]*{#"scripts": { "sbom": "cyclonedx-npm --spec-version 1.5 --output-file sbom.json",#' "$pj"
  fi
}
export -f fix_pkg
find . -name package.json -print0 | xargs -0 -I{} bash -c 'fix_pkg "$@"' _ {}

# 3) Show any remaining offenders (should be empty)
log "Scanning for leftover ^5.x pins"
grep -Rn '"@cyclonedx/cyclonedx-npm": *"[^"]*5' || log "No ^5.x pins found"

# 4) Create/refresh packages/regwatcher (minimal deps)
log "Ensuring packages/regwatcher exists"
mkdir -p packages/regwatcher/bin packages/regwatcher/.cache
cat > packages/regwatcher/package.json <<'JSON'
{
  "name": "@apgms/regwatcher",
  "version": "0.1.2",
  "type": "module",
  "private": true,
  "main": "index.mjs",
  "bin": { "regwatcher": "bin/run.mjs" },
  "dependencies": {
    "dotenv": "^16.4.5",
    "js-yaml": "^4.1.0",
    "nodemailer": "^6.9.13",
    "undici": "^6.19.8"
  }
}
JSON

cat > packages/regwatcher/index.mjs <<'MJS'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { fetch } from 'undici';

const ROOT = process.cwd();
const WATCHLIST = path.join(ROOT, 'packages/regwatcher/watchlist.yaml');
const CACHE_DIR = path.join(ROOT, 'packages/regwatcher/.cache');
const STATE = path.join(CACHE_DIR, 'state.json');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');

function loadWatchlist(){
  const raw = fs.readFileSync(WATCHLIST, 'utf8');
  const doc = yaml.load(raw);
  if (!Array.isArray(doc)) throw new Error('watchlist.yaml must be an array of {name,url,pattern?,notes?}');
  return doc;
}
function loadState(){ try { return JSON.parse(fs.readFileSync(STATE,'utf8')); } catch { return {}; } }
function saveState(s){ fs.mkdirSync(CACHE_DIR,{recursive:true}); fs.writeFileSync(STATE, JSON.stringify(s,null,2)); }

export async function runOnce({ json=false } = {}){
  const list = loadWatchlist();
  const state = loadState();
  const now = new Date().toISOString();
  const results = [];

  for (const item of list){
    const { name, url, pattern } = item;
    try{
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      const norm = text.replace(/\s+/g, ' ').slice(0, 2_000_000);
      const snippet = pattern ? (norm.match(new RegExp(pattern,'i'))||[''])[0] : norm;
      const hash = sha(snippet);
      const prev = state[name]?.hash || null;
      const changed = !!(prev && prev !== hash);
      state[name] = { hash, url, checkedAt: now, changedAt: changed ? now : (state[name]?.changedAt || null) };
      results.push({ name, url, changed, timestamp: now });
    }catch(e){
      results.push({ name, url, error: String(e) });
    }
  }
  saveState(state);
  if (json) console.log(JSON.stringify(results,null,2));
  return results;
}
MJS

cat > packages/regwatcher/mailer.mjs <<'MJS'
import nodemailer from 'nodemailer';

export async function sendEmail({ subject, text }){
  const {
    SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
    EMAIL_FROM, EMAIL_TO
  } = process.env;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE || 'false') === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });

  await transporter.sendMail({ from: EMAIL_FROM, to: EMAIL_TO, subject, text });
}
MJS

cat > packages/regwatcher/bin/run.mjs <<'MJS'
#!/usr/bin/env node
import { config as dotenv } from 'dotenv';
import path from 'node:path';
dotenv({ path: path.join(process.cwd(), '.env.local') });

import { runOnce } from '../index.mjs';
import { sendEmail } from '../mailer.mjs';

const args = new Set(process.argv.slice(2));
const wantEmail = args.has('--email');
const always = args.has('--always');
const json = args.has('--json');

const results = await runOnce({ json });
const changed = results.filter(r => r.changed);

if (wantEmail && (always || changed.length)){
  const lines = results.map(r => r.error
    ? `✗ ${r.name}  ERROR: ${r.error}`
    : `${r.changed ? '•' : '–'} ${r.name}  ${r.changed ? 'CHANGED' : 'no change'}  ${r.url}`
  );
  await sendEmail({ subject: `[RegWatcher] ${changed.length} changes`, text: lines.join('\n') });
  console.log(`[email] sent (${changed.length} changes)`);
}else{
  console.log(`[email] skipped (changes: ${changed.length})`);
}
MJS
chmod +x packages/regwatcher/bin/run.mjs

# 5) Seed a basic watchlist if missing
if [ ! -f packages/regwatcher/watchlist.yaml ]; then
  cat > packages/regwatcher/watchlist.yaml <<'YAML'
- name: GIC rate
  url: https://www.ato.gov.au/tax-rates-and-codes/general-interest-charge-rates
  notes: "General Interest Charge quarterly rates"
  pattern: "([0-9]{1,2}\\.[0-9]{1,2}\\s?%)"

- name: SIC rate
  url: https://www.ato.gov.au/tax-rates-and-codes/shortfall-interest-charge-rates
  notes: "Shortfall Interest Charge quarterly rates"
  pattern: "([0-9]{1,2}\\.[0-9]{1,2}\\s?%)"

- name: SG rate
  url: https://www.ato.gov.au/rates-and-thresholds/key-superannuation-rates-and-thresholds/super-guarantee-rate

- name: PAYG tax table index
  url: https://www.ato.gov.au/tax-professionals/tax-table-updates

- name: ATO Online status
  url: https://services-status.ato.gov.au/

- name: SBR status
  url: https://status.sbr.gov.au/
YAML
fi

# 6) Ensure root scripts for convenience
if grep -q '"scripts"' package.json; then
  sed -i -E 's#"scripts":[[:space:]]*{#"scripts": { "regwatcher:once": "node packages/regwatcher/bin/run.mjs --json", "regwatcher:email": "node packages/regwatcher/bin/run.mjs --email --always",#' package.json
fi

# 7) Install (no frozen lockfile), fallback by removing lock if still mismatched
log "Installing deps (no frozen lockfile)"
if ! pnpm install --no-frozen-lockfile; then
  log "Retry after removing pnpm-lock.yaml (lock mismatch)"
  rm -f pnpm-lock.yaml
  pnpm install --no-frozen-lockfile
fi

log "Smoke run (no email)"
pnpm run regwatcher:once || true

log "Done."
