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
