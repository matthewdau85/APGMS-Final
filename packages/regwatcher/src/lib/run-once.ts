// packages/regwatcher/src/lib/run-once.ts
import { fetchSanitizedHtml, type FetchSanitizedHtmlResult } from "./http.js";

/**
 * Back-compat helper.
 * Historically this returned an undici Response; for regwatcher’s actual usage
 * (src/run-once.ts), you want html+text reliably. This wrapper provides that.
 */
export async function runOnce(
  url: string,
  headers?: Record<string, string>
): Promise<FetchSanitizedHtmlResult> {
  return fetchSanitizedHtml(url, headers);
}
