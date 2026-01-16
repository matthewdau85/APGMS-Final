#!/usr/bin/env node
/**
 * scripts/readiness/availability.cjs
 *
 * Checks that the API is "ready" (200 OK).
 *
 * Env:
 *   READINESS_API_BASE_URL (default: http://localhost:3000)
 *   READINESS_READY_PATH   (default: /ready)
 *   READINESS_HTTP_TIMEOUT_MS (default: 5000)
 */

const process = require("node:process");

async function main() {
  const base = (process.env.READINESS_API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const readyPath = process.env.READINESS_READY_PATH || "/ready";
  const timeoutMs = Number(process.env.READINESS_HTTP_TIMEOUT_MS || "5000");

  const url = `${base}${readyPath.startsWith("/") ? "" : "/"}${readyPath}`;

  console.log(`[availability] Checking ${url} ...`);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) {
      console.error(`[availability] NOT OK (${res.status})`);
      process.exit(1);
    }
    console.log(`[availability] OK (${res.status})`);
    process.exit(0);
  } catch (e) {
    console.error(`[availability] ERROR: ${e && e.message ? e.message : String(e)}`);
    process.exit(1);
  } finally {
    clearTimeout(t);
  }
}

main();
