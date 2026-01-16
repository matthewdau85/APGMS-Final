import { ensureLayout, writeSnapshot } from "./lib/store.js";
import { htmlToCanonicalText } from "./lib/canonicalize.js";
import { TARGETS } from "./targets.js";
import { fetch } from "undici";

const UA = "APGMS-Regwatch/0.1 (+local dev)";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    headers: { "user-agent": UA, "accept": "text/html, text/plain;q=0.8, */*;q=0.5" }
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

async function main() {
  ensureLayout();
  let changes = 0;

  for (const t of TARGETS) {
    try {
      const html = await fetchHtml(t.url);
      const text = htmlToCanonicalText(html);
      const { changedEvent } = writeSnapshot(t, html, text);
      if (changedEvent) {
        changes++;
        console.log(`[change] ${t.id} ${changedEvent.previousSha?.slice(0, 8) ?? "none"} -> ${changedEvent.currentSha.slice(0, 8)}`);
      } else {
        console.log(`[nochange] ${t.id}`);
      }
      // polite spacing between requests
      await new Promise((r) => setTimeout(r, 2500));
    } catch (e: any) {
      console.error(`[error] ${t.id}: ${e?.message || e}`);
    }
  }

  console.log(`Done. Changes detected: ${changes}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
