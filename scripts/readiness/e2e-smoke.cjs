"use strict";

const { setTimeout: sleep } = require("timers/promises");

async function fetchWithTimeout(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const url = process.env.READINESS_READY_URL || "http://127.0.0.1:3000/ready";
  const timeoutMs = Number(process.env.READINESS_READY_TIMEOUT_MS || "30000");

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error("Non-OK response: " + res.status + " " + body);
      }
      process.stdout.write("[e2e-smoke] OK: " + url + "\n");
      return;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(750);
    }
  }
}

main().catch((err) => {
  process.stderr.write("[e2e-smoke] FAIL: " + (err && err.message ? err.message : String(err)) + "\n");
  process.exit(1);
});
