// One-shot sweep: fetch -> sanitize -> snapshot -> diff -> log
import { fetchSanitizedHtml } from "./lib/http.js";
import { ensureLayout, snapshotPaths, getLastSnapshot, writeSnapshot, recordChangeEvent, TARGET_DATA_DIR } from "./lib/store.js";
import { diffText } from "./lib/diff.js";
import { TARGETS } from "./targets.js";
import { createHash } from "crypto";
import path from "node:path";
import fs from "node:fs";

const SPACING_MS = Number(process.env.REGWATCH_SPACING_MS ?? "2500");

function sha256(s: string) { return createHash("sha256").update(s).digest("hex"); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  ensureLayout();
  for (const t of TARGETS) {
    const started = Date.now();
    try {
      const { html, text } = await fetchSanitizedHtml(t.url);
      const hash = sha256(text);
      const last = getLastSnapshot(t.id);

      if (last && last.hash === hash) {
        const { metaPath } = snapshotPaths(t.id, new Date());
        fs.mkdirSync(path.dirname(metaPath), { recursive: true });
        fs.writeFileSync(
          metaPath.replace(/\.json$/, ".heartbeat.json"),
          JSON.stringify({ id: t.id, url: t.url, ts: new Date().toISOString(), unchanged: true, hash }, null, 2),
          "utf8"
        );
        await sleep(SPACING_MS);
        continue;
      }

      let diff: string | undefined;
      if (last?.textPath && fs.existsSync(last.textPath)) {
        const prev = fs.readFileSync(last.textPath, "utf8");
        diff = diffText(prev, text);
      }

      const meta = writeSnapshot(
        t,
        { html, text, hash, fetchedAt: new Date().toISOString(), tookMs: Date.now() - started },
        diff
      );

      await recordChangeEvent({
        targetId: t.id,
        url: t.url,
        ts: meta.ts,
        hashNew: hash,
        hashPrev: last?.hash ?? null,
        bytesHtml: meta.bytesHtml,
        bytesText: meta.bytesText,
        diffFile: meta.diffPath ? path.relative(TARGET_DATA_DIR, meta.diffPath) : null
      });

      await sleep(SPACING_MS);
    } catch (err: any) {
      await recordChangeEvent({
        targetId: t.id,
        url: t.url,
        ts: new Date().toISOString(),
        error: err?.message ?? String(err)
      });
      await sleep(SPACING_MS);
    }
  }
}
run().catch(e => { console.error(e); process.exit(1); });
