// packages/regwatcher/src/lib/http.ts
import { fetch } from "undici";
import { htmlToCanonicalText } from "./canonicalize.js";

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-AU,en;q=0.9",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "upgrade-insecure-requests": "1",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max) + "...(truncated)";
}

export type FetchSanitizedHtmlResult = {
  html: string;
  text: string;
  finalUrl?: string;
  status: number;
  bytesHtml: number;
  bytesText: number;
};

export async function httpGet(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      ...BROWSER_HEADERS,
      ...(headers ?? {}),
    },
  });
  return res;
}

/**
 * Fetch HTML as a browser would, convert to canonical low-noise text, and return both.
 * - Returns strings on success, otherwise throws.
 * - Retries transient failures with backoff.
 */
export async function fetchSanitizedHtml(
  url: string,
  headers?: Record<string, string>,
  opts?: { attempts?: number; timeoutMs?: number }
): Promise<FetchSanitizedHtmlResult> {
  const attempts = Math.max(1, Number(opts?.attempts ?? 3));
  const timeoutMs = Math.max(1, Number(opts?.timeoutMs ?? 30000));

  let lastErr: unknown;

  for (let i = 1; i <= attempts; i++) {
    const started = Date.now();
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          ...BROWSER_HEADERS,
          ...(headers ?? {}),
        },
      });

      clearTimeout(t);

      const status = res.status;

      // Always read body as text (even on errors) so we can log context.
      const bodyText = await res.text();

      if (!res.ok) {
        // ATO (and other sites) sometimes return branded 404 HTML pages.
        // Treat as an error but include snippet for diagnosis.
        throw new Error(
          `HTTP ${status} for ${url} (body: ${truncate(bodyText, 600)})`
        );
      }

      if (typeof bodyText !== "string" || bodyText.length === 0) {
        throw new Error(`Empty body for ${url} (HTTP ${status})`);
      }

      const html = bodyText;
      const text = htmlToCanonicalText(html);

      if (typeof text !== "string") {
        throw new Error(`Canonicalization produced non-string for ${url}`);
      }

      return {
        html,
        text,
        finalUrl: (res as any).url,
        status,
        bytesHtml: Buffer.byteLength(html),
        bytesText: Buffer.byteLength(text),
      };
    } catch (e) {
      lastErr = e;

      // Backoff: 250ms, 750ms, 1750ms ...
      const took = Date.now() - started;
      const backoff = 250 + (i - 1) * (i - 1) * 500;

      // If final attempt, throw a single useful error.
      if (i === attempts) {
        const msg =
          e instanceof Error ? e.message : String(e ?? "unknown error");
        throw new Error(
          `fetchSanitizedHtml failed after ${attempts} attempts in ${took}ms: ${msg}`
        );
      }

      await sleep(backoff);
    }
  }

  // Should be unreachable.
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
