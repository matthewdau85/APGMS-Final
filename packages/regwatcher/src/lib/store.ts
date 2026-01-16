import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "./hash.js";
import type { ChangeEvent, Manifest, SnapshotMeta, Target } from "../types.js";
import { unifiedSampleDiff } from "./diff.js";

const DATA_ROOT = new URL("../../data", import.meta.url);
const rootPath = (p = ".") => join(DATA_ROOT.pathname, p);

export function ensureLayout() {
  mkdirSync(rootPath(), { recursive: true });
  mkdirSync(rootPath("snapshots"), { recursive: true });
  mkdirSync(rootPath("manifests"), { recursive: true });
  mkdirSync(rootPath("events"), { recursive: true });
}

export function manifestPath(targetId: string) {
  return rootPath(`manifests/${targetId}.json`);
}

export function loadManifest(target: Target): Manifest {
  const p = manifestPath(target.id);
  if (!existsSync(p)) {
    return { target, snapshots: [], changes: [] };
  }
  const json = readFileSync(p, "utf8");
  const data = JSON.parse(json) as Manifest;
  // retain current target shape (in case urls/frequency changed)
  data.target = target;
  return data;
}

export function saveManifest(m: Manifest) {
  writeFileSync(manifestPath(m.target.id), JSON.stringify(m, null, 2) + "\n", "utf8");
}

export function writeSnapshot(target: Target, html: string, text: string): {
  meta: SnapshotMeta;
  changedEvent: ChangeEvent | null;
} {
  const now = new Date().toISOString();
  const base = `${target.id}-${now.replace(/[:.]/g, "")}`;
  const htmlPath = rootPath(`snapshots/${base}.html`);
  const txtPath = rootPath(`snapshots/${base}.txt`);

  writeFileSync(htmlPath, html, "utf8");
  writeFileSync(txtPath, text, "utf8");

  const currentSha = sha256(text);
  const meta: SnapshotMeta = {
    id: now,
    targetId: target.id,
    url: target.url,
    sha256: currentSha,
    bytesHtml: Buffer.byteLength(html),
    bytesText: Buffer.byteLength(text),
    createdAt: now
  };

  const manifest = loadManifest(target);
  const prev = manifest.snapshots.at(-1);
  manifest.snapshots.push(meta);

  let event: ChangeEvent | null = null;
  if (!prev || prev.sha256 !== currentSha) {
    // create diff event
    let sample = "";
    let diffs = { added: 0, removed: 0, changed: 0 };
    if (prev) {
      const prevText = readFileSync(rootPath(`snapshots/${target.id}-${prev.id.replace(/[:.]/g, "")}.txt`), "utf8");
      const d = unifiedSampleDiff(prevText, text, 120);
      diffs = { added: d.added, removed: d.removed, changed: d.changed };
      sample = d.sample;
    }

    event = {
      id: now,
      targetId: target.id,
      url: target.url,
      previousSha: prev?.sha256 || null,
      currentSha,
      createdAt: now,
      diffSummary: { ...diffs, sample }
    };
    manifest.changes.push(event);
  }

  saveManifest(manifest);
  return { meta, changedEvent: event };
}

export function readRecentChanges(limit = 50): ChangeEvent[] {
  const mfDir = rootPath("manifests");
  const out: ChangeEvent[] = [];
  for (const f of readdirSync(mfDir)) {
    if (!f.endsWith(".json")) continue;
    const m = JSON.parse(readFileSync(join(mfDir, f), "utf8")) as Manifest;
    for (const ev of m.changes) out.push(ev);
  }
  out.sort((a, b) => a.id.localeCompare(b.id)); // ISO asc
  return out.slice(-limit);
}

export function getLastSnapshot(targetId: string): SnapshotMeta | null {
  const p = manifestPath(targetId);
  if (!existsSync(p)) return null;
  const m = JSON.parse(readFileSync(p, "utf8")) as Manifest;
  return m.snapshots.at(-1) ?? null;
}
