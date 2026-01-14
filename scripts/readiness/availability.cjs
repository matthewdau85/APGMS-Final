#!/usr/bin/env node
/**
 * Availability check:
 * - Ensures /ready returns 200.
 * - If /ready returns non-200 (including 503), keep retrying until attempts expire.
 * - Optional: autostart api-gateway via docker compose when nothing responds.
 *
 * This script is intentionally conservative:
 * - If something is already listening and responds (even 503), we do NOT try to start another server.
 * - If nothing responds and AUTOSTART=1, we start the api-gateway via docker compose and wait.
 */

const { spawnSync } = require("node:child_process");
const http = require("node:http");

const DEFAULT_URL = process.env.READY_URL || "http://localhost:3000/ready";
const AUTOSTART =
  process.env.AUTOSTART === "1" || process.env.AUTOSTART === "true";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res);
    });
    req.on("error", reject);
  });
}

async function waitForReady(url, attempts, delayMs) {
  let lastStatus = null;
  let lastErr = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await get(url);
      lastStatus = res.statusCode;

      if (res.statusCode === 200) {
        return { ok: true, statusCode: res.statusCode, attemptsUsed: i };
      }

      console.log(`[availability] /ready status ${res.statusCode} (attempt ${i}/${attempts}) - retrying...`);
    } catch (err) {
      lastErr = err;
      console.log(`[availability] /ready request failed (attempt ${i}/${attempts}) - retrying...`);
    }

    await sleep(delayMs);
  }

  return { ok: false, lastStatus, lastErr, attemptsUsed: attempts };
}

function startApiGatewayWithCompose() {
  console.log("[availability] Starting API gateway via docker compose ...");
  const res = spawnSync("docker", ["compose", "up", "-d", "api-gateway"], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    throw new Error("docker compose up -d api-gateway failed");
  }
}

async function main() {
  const url = DEFAULT_URL;
  console.log(`[availability] Checking ${url} ...`);

  let firstRes = null;
  let firstProbeHadResponse = false;

  try {
    firstRes = await get(url);
    firstProbeHadResponse = true;
  } catch (err) {
    firstProbeHadResponse = false;
  }

  if (firstProbeHadResponse && firstRes && firstRes.statusCode === 200) {
    console.log("[availability] OK (200)");
    process.exit(0);
  }

  if (firstProbeHadResponse && firstRes) {
    console.log(`[availability] /ready responded with ${firstRes.statusCode}; waiting for 200...`);
    const waited = await waitForReady(url, 40, 500);
    if (waited.ok) {
      console.log("[availability] OK (200)");
      process.exit(0);
    }

    const statusMsg =
      waited.lastStatus != null ? `last status ${waited.lastStatus}` : "no status";
    console.error(`[availability] /ready never returned 200 within retry window (${statusMsg}).`);
    process.exit(1);
  }

  if (!AUTOSTART) {
    console.error("[availability] /ready not reachable and AUTOSTART is disabled.");
    process.exit(1);
  }

  try {
    startApiGatewayWithCompose();
  } catch (err) {
    console.error("[availability] failed to start api-gateway:", err.message);
    process.exit(1);
  }

  const waited = await waitForReady(url, 40, 500);

  if (!waited.ok) {
    const statusMsg =
      waited.lastStatus != null ? `last status ${waited.lastStatus}` : "no status";
    console.error(`[availability] /ready never returned 200 after starting gateway (${statusMsg}).`);
    process.exit(1);
  }

  console.log("[availability] OK (200)");
  process.exit(0);
}

main().catch((err) => {
  console.error("[availability] fatal:", err && err.stack ? err.stack : String(err));
  process.exit(1);
});
