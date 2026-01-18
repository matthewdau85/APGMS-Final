import { fetch } from "undici";
import * as cheerio from "cheerio";

export async function fetchSanitizedHtml(url: string): Promise<{ html: string; text: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "APGMS-RegWatcher/1.0 (+audit-snapshots; compliance)",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-AU,en;q=0.9"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.text();

  const $ = cheerio.load(body);
  $("script,noscript,style,iframe,svg,canvas,template").remove();
  $('[role="navigation"], nav, footer, [aria-live], [role="alert"]').remove();

  const sanitizedHtml = $.html({ decodeEntities: true });
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { html: sanitizedHtml, text };
}
