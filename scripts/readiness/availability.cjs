#!/usr/bin/env node
/**
 * Availability check:
 * - Ensures /ready returns 200.
 * - If /ready returns non-200 (including 503), keep retrying until attempts expire.
 * - Optional: autostart api-gateway if nothing is listening.
 *
 * This script is intentionally conservative:
 * - If something is already listening and responds (even 503), we do NOT try to start another server.
 * - If nothing responds and AUTOSTART=1, we start the api-gateway and wait.
 */

const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_URL = process.env.READY_URL || "http://localhost:3000/ready";
const AUTOSTART = process.env.AUTOSTART === "1" || process.env.AUTOSTART === "true";
const PORT = Number(process.env.READY_PORT || "3000");

const PID_FILE = path.resolve(process.cwd(), ".readiness-api-gateway.pid");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      // Consume body to free socket; keep only status for decision-making
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

      // Non-200 (including 503) is "not ready yet" -> retry until attempts exhausted
      console.log(`[availability] /ready status ${res.statusCode} (attempt ${i}/${attempts}) - retrying...`);
    } catch (err) {
      lastErr = err;
      console.log(`[availability] /ready request failed (attempt ${i}/${attempts}) - retrying...`);
    }

    await sleep(delayMs);
  }

  return { ok: false, lastStatus, lastErr, attemptsUsed: attempts };
}

async function ensurePortFree(port) {
  // If a previous readiness run started the gateway, kill it.
  if (!fs.existsSync(PID_FILE)) return;

  let pid = null;
  try {
    pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
  } catch (_) {
    // ignore
  }

  if (!pid || Number.isNaN(pid)) {
    try {
      fs.unlinkSync(PID_FILE);
    } catch (_) {}
    return;
  }

  try {
    process.kill(pid, 0);
  } catch (_) {
    // Not running
    try {
      fs.unlinkSync(PID_FILE);
    } catch (_) {}
    return;
  }

  console.log(`[availability] Port ${port} already in use by pid ${pid} (node). Stop it (e.g., kill ${pid}) before rerunning readiness.`);
  process.exit(1);
}

async function main() {
  const url = DEFAULT_URL;
  console.log(`[availability] Checking ${url} ...`);

  if (AUTOSTART) {
    await ensurePortFree(PORT);
  }

  // First probe: if it responds (even 503), do NOT attempt autostart; just wait for readiness.
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

    const statusMsg = waited.lastStatus != null ? `last status ${waited.lastStatus}` : "no status";
    console.error(`[availability] /ready never returned 200 within retry window (${statusMsg}).`);
    process.exit(1);
  }

  // No response: if AUTOSTART is off, fail.
  if (!AUTOSTART) {
    console.error("[availability] /ready not reachable and AUTOSTART is disabled.");
    process.exit(1);
  }

  // AUTOSTART path: start api-gateway then wait for 200.
  console.log("[availability] Starting API gateway on port 3000 ...");

  const child = spawn("pnpm", ["--filter", "@apgms/api-gateway", "dev"], {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  fs.writeFileSync(PID_FILE, String(child.pid), "utf8");

  const waited = await waitForReady(url, 40, 500);

  if (!waited.ok) {
    const statusMsg = waited.lastStatus != null ? `last status ${waited.lastStatus}` : "no status";
    console.error(`[availability] /ready never returned 200 after starting gateway (${statusMsg}).`);
    try {
      child.kill("SIGKILL");
    } catch (_) {}
    try {
      fs.unlinkSync(PID_FILE);
    } catch (_) {}
    process.exit(1);
  }

  console.log("[availability] OK (200)");
  try {
    child.kill("SIGKILL");
  } catch (_) {}
  try {
    fs.unlinkSync(PID_FILE);
  } catch (_) {}
  process.exit(0);
}

main().catch((err) => {
  console.error("[availability] fatal:", err && err.stack ? err.stack : String(err));
  process.exit(1);
});
