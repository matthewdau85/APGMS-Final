import fs from "node:fs";
import path from "node:path";
import type { Target } from "../targets.js";

const PKG_ROOT = process.cwd();
export const TARGET_DATA_DIR = path.resolve(PKG_ROOT, "data");
const EVENTS_FILE = path.join(TARGET_DATA_DIR, "changes.ndjson");

export function ensureLayout() {
  fs.mkdirSync(TARGET_DATA_DIR, { recursive: true });
  if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, "", "utf8");
}

export function snapshotPaths(targetId: string, when: Date) {
  const dir = path.join(TARGET_DATA_DIR, targetId);
  const stamp = when.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const base = path.join(dir, stamp);
  return {
    dir, base,
    htmlPath: base + ".html",
    textPath: base + ".txt",
    metaPath: base + ".json",
    diffPath: base + ".diff"
  };
}

export function writeSnapshot(
  t: Target,
  data: { html: string; text: string; hash: string; fetchedAt: string; tookMs: number },
  diff?: string
) {
  const when = new Date();
  const p = snapshotPaths(t.id, when);
  fs.mkdirSync(p.dir, { recursive: true });
  fs.writeFileSync(p.htmlPath, data.html, "utf8");
  fs.writeFileSync(p.textPath, data.text, "utf8");
  if (diff && diff.trim()) fs.writeFileSync(p.diffPath, diff, "utf8");

  const meta = {
    id: t.id, name: t.name, url: t.url, ts: when.toISOString(),
    hash: data.hash, bytesHtml: Buffer.byteLength(data.html), bytesText: Buffer.byteLength(data.text),
    tookMs: data.tookMs, htmlFile: path.basename(p.htmlPath), textFile: path.basename(p.textPath),
    diffFile: diff ? path.basename(p.diffPath) : null
  };
  fs.writeFileSync(p.metaPath, JSON.stringify(meta, null, 2), "utf8");
  return { ...meta, ...p };
}

export function getLastSnapshot(targetId: string) {
  const dir = path.join(TARGET_DATA_DIR, targetId);
  if (!fs.existsSync(dir)) return null;
  const metas = fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.endsWith(".heartbeat.json")).sort();
  if (metas.length === 0) return null;
  const lastMeta = path.join(dir, metas[metas.length - 1]);
  try {
    const meta = JSON.parse(fs.readFileSync(lastMeta, "utf8"));
    const base = lastMeta.slice(0, -5);
    return {
      ...meta,
      metaPath: lastMeta,
      textPath: base + ".txt",
      htmlPath: base + ".html",
      diffPath: fs.existsSync(base + ".diff") ? base + ".diff" : undefined
    };
  } catch { return null; }
}

export async function recordChangeEvent(evt: any) {
  ensureLayout();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(evt) + "\n", "utf8");
}

export function readRecentChanges(limit: number) {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const lines = fs.readFileSync(EVENTS_FILE, "utf8").trim().split("\n");
  const out: any[] = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try { out.push(JSON.parse(lines[i])); } catch {}
  }
  return out;
}

export function loadManifest(t: Target) {
  const dir = path.join(TARGET_DATA_DIR, t.id);
  const last = getLastSnapshot(t.id);
  const count = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).length : 0;
  return { id: t.id, name: t.name, url: t.url, lastHash: last?.hash ?? null, lastTs: last?.ts ?? null, snapshots: count };
}
