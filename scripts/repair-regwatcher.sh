#!/usr/bin/env bash
# Normalize CRLF if copied from Windows
sed -i 's/\r$//' "$0" 2>/dev/null || true
set -eu
if [ -n "${BASH_VERSION:-}" ]; then set -o pipefail; fi

ROOT="${ROOT:-$PWD}"
echo "[repair] repo: $ROOT"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 2; }; }
need node; need git; need sed; need grep

# 1) Ensure CycloneDX CLI uses a valid version (^4.1.2)
#    Replace any cyclonedx-npm/cyclonedx-npm references and pin to ^4.1.2
fix_pkg_json_versions() {
  local f="$1"
  node - "$f" <<'NODE'
const fs = require('fs');
const p = process.argv[1];
let j; try { j = JSON.parse(fs.readFileSync(p,'utf8')); } catch { process.exit(0); }
let touched = false;
for (const bucket of ['dependencies','devDependencies','optionalDependencies']) {
  if (!j[bucket]) continue;
  if (j[bucket]['@cyclonedx/cyclonedx-npm']) {
    delete j[bucket]['@cyclonedx/cyclonedx-npm'];
    touched = true;
  }
  if (j[bucket]['@cyclonedx/cyclonedx-npm']) {
    j[bucket]['@cyclonedx/cyclonedx-npm'] = '^4.1.2'; touched = true;
  }
}
j.scripts = j.scripts || {};
if (j.scripts.sbom && j.scripts.sbom.includes('cyclonedx-npm')) {
  j.scripts.sbom = j.scripts.sbom.replace('cyclonedx-npm','cyclonedx-npm'); touched = true;
}
if (!j.scripts.sbom) { j.scripts.sbom = "cyclonedx-npm --spec-version 1.5 --output-file sbom.json"; touched = true; }
if (touched) fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
NODE
}

export -f fix_pkg_json_versions
git ls-files | grep package.json | xargs -I{} bash -c 'fix_pkg_json_versions "$@"' _ {}

# Rewrite any source/CI references from cyclonedx-npm -> cyclonedx-npm
git ls-files | grep -E '\.(ya?ml|sh|md|cjs|mjs|ts|js)$' | while read -r f; do
  if grep -q 'cyclonedx-npm' "$f"; then
    sed -i -E 's/cyclonedx-npm/cyclonedx-npm/g' "$f"
    echo "[rewrite] $f"
  fi
done

# 2) (Re)create packages/regwatcher minimal, with deps we actually use
mkdir -p packages/regwatcher/packages-cache packages/regwatcher/bin
cat > packages/regwatcher/package.json <<'JSON'
{
  "name": "@apgms/regwatcher",
  "version": "0.1.1",
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

# index.mjs – loads watchlist.yaml, fetches pages, diffs by SHA, returns summary
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

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function loadWatchlist() {
  const y = fs.readFileSync(WATCHLIST, 'utf8');
  const doc = yaml.load(y);
  if (!Array.isArray(doc)) throw new Error('watchlist.yaml must be a YAML array of {name,url,notes?,pattern?}');
  return doc;
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}
function saveState(s) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
}

export async function runOnce({ json=false } = {}) {
  const list = loadWatchlist();
  const state = loadState();
  const now = new Date().toISOString();
  const results = [];

  for (const item of list) {
    const { name, url, pattern } = item;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      const content = text.replace(/\s+/g, ' ').slice(0, 2_000_000); // normalize & cap
      const hash = sha256(pattern ? (content.match(new RegExp(pattern, 'i'))||[''])[0] : content);
      const prev = state[name]?.hash || null;
      const changed = prev && prev !== hash;
      state[name] = { hash, url, checkedAt: now, changedAt: changed ? now : (state[name]?.changedAt || null) };
      results.push({ name, url, changed: !!changed, timestamp: now });
    } catch (e) {
      results.push({ name, url, error: String(e) });
    }
  }

  saveState(state);
  if (json) console.log(JSON.stringify(results, null, 2));
  return results;
}
MJS

# mailer.mjs – basic SMTP mail using env
cat > packages/regwatcher/mailer.mjs <<'MJS'
import nodemailer from 'nodemailer';

export async function sendEmail({ subject, text }) {
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

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject,
    text
  });
}
MJS

# bin/run.mjs – loads dotenv, parses flags, runs, optionally emails
cat > packages/regwatcher/bin/run.mjs <<'MJS'
#!/usr/bin/env node
import { config as dotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv({ path: path.join(process.cwd(), '.env.local') });

import { runOnce } from '../index.mjs';
import { sendEmail } from '../mailer.mjs';

const args = new Set(process.argv.slice(2));
const wantEmail = args.has('--email');
const always = args.has('--always');
const json = args.has('--json');

const results = await runOnce({ json });

const changed = results.filter(r => r.changed);
if (wantEmail && (always || changed.length)) {
  const lines = results.map(r => {
    if (r.error) return `✗ ${r.name}  ERROR: ${r.error}`;
    return `${r.changed ? '•' : '–'} ${r.name}  ${r.changed ? 'CHANGED' : 'no change'}  ${r.url}`;
  });
  await sendEmail({
    subject: `[RegWatcher] ${changed.length} changes`,
    text: lines.join('\n')
  });
  console.log(`[email] sent (${changed.length} changes)`);
} else {
  console.log(`[email] skipped (changes: ${changed.length})`);
}
MJS
chmod +x packages/regwatcher/bin/run.mjs

# 3) Sample watchlist if missing
if [ ! -f packages/regwatcher/watchlist.yaml ]; then
  cat > packages/regwatcher/watchlist.yaml <<'YAML'
- name: GIC rate
  url: https://www.ato.gov.au/tax-rates-and-codes/general-interest-charge-rates
  notes: "General Interest Charge quarterly rates"
  pattern: "([0-9]{1,2}\\.[0-9]{1,2}\\s?%)"   # example: capture first percent-looking number

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
  echo "[watchlist] created packages/regwatcher/watchlist.yaml"
fi

# 4) Ensure .env.local.example is sane (no angle brackets)
if [ ! -f .env.local.example ]; then
  cat > .env.local.example <<'ENV'
# SMTP & email
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey_or_username
SMTP_PASS=your_smtp_password
EMAIL_FROM=no-reply@yourdomain.com
EMAIL_TO=you@example.com
ENV
  echo "[env] wrote .env.local.example"
fi

# 5) Install deps with a non-frozen lockfile
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --no-frozen-lockfile
else
  corepack enable || true
  corepack prepare pnpm@9 --activate
  pnpm install --no-frozen-lockfile
fi

echo "[smoke] run once (no email)"
node packages/regwatcher/bin/run.mjs --json || true
echo "[repair] done."
