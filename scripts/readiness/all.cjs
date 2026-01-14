#!/usr/bin/env node
/**
 * Global readiness runner.
 *
 * Currently:
 *   - Runs availability-and-performance pillar
 *   - On failure:
 *       - prints RED
 *       - opens an incident
 *       - exits non-zero
 */

const { spawn } = require("node:child_process");
const path = require("node:path");
const process = require("node:process");
const fs = require("node:fs");
const http = require("node:http");

function runNodeScript(relPath, label) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(__dirname, relPath);
    const child = spawn("node", [scriptPath], {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });

    child.on("exit", (code) => {
      const ok = code === 0;
      resolve({ label, ok, code });
    });
  });
}

function openIncident(pillars, summary) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(__dirname, "open-incident.cjs");

    if (!fs.existsSync(scriptPath)) {
      console.error("[readiness:all] open-incident.cjs not found; cannot create incident file.");
      return resolve();
    }

    const args = [
      scriptPath,
      `--pillars=${pillars}`,
      `--summary=${summary}`,
      "--script=readiness:all",
    ];

    const child = spawn("node", args, {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });

    child.on("exit", () => resolve());
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await get(url);
      lastStatus = res.statusCode;

      if (res.statusCode === 200) {
        return { ok: true, statusCode: res.statusCode, attemptsUsed: i };
      }

      console.log(`[readiness:all] /ready status ${res.statusCode} (attempt ${i}/${attempts}) - retrying...`);
    } catch (err) {
      lastErr = err;
      console.log(`[readiness:all] /ready request failed (attempt ${i}/${attempts}) - retrying...`);
    }

    await sleep(delayMs);
  }

  return { ok: false, lastStatus, lastErr, attemptsUsed: attempts };
}

async function runAvailabilityPillar() {
  const label = "Availability & Performance";
  const result = await runNodeScript("./availability-and-performance.cjs", label);

  if (result.ok) {
    return result;
  }

  const DEFAULT_URL = process.env.READY_URL || "http://localhost:3000/ready";
  const MAX_ATTEMPTS = Number(process.env.READINESS_MAX_ATTEMPTS || "80");
  const DELAY_MS = Number(process.env.READINESS_DELAY_MS || "500");

  console.log(`[readiness:all] ${label} failed (exit ${result.code}); waiting for ${DEFAULT_URL} to return 200 before final verdict.`);
  const waited = await waitForReady(DEFAULT_URL, MAX_ATTEMPTS, DELAY_MS);

  if (!waited.ok) {
    const statusMsg =
      waited.lastStatus != null ? `last status ${waited.lastStatus}` : "no status";
    console.error(`[readiness:all] /ready never returned 200 within ${MAX_ATTEMPTS} attempts (${statusMsg}).`);
    return result;
  }

  console.log(
    `[readiness:all] /ready returned 200 after ${waited.attemptsUsed} attempt(s); rerunning ${label} once.`
  );

  return runNodeScript("./availability-and-performance.cjs", label);
}

async function main() {
  console.log("=== GLOBAL READINESS CHECK (ALL PILLARS) ===");

  const results = [];

  // For now we only have one pillar wired up
  results.push(await runAvailabilityPillar());

  const failing = results.filter((r) => !r.ok);

  if (failing.length === 0) {
    console.log("=== ALL PILLARS GREEN – SAFE TO PROCEED ===");
    process.exit(0);
  }

  console.error("=== GLOBAL READINESS: RED ===");
  for (const f of failing) {
    console.error(` - ${f.label} failed (exit code ${f.code})`);
  }

  const failedPillars = failing.map((r) => r.label).join(", ");
  const summary = `Global readiness failed; pillars: ${failedPillars}`;

  await openIncident(failedPillars, summary);

  process.exit(1);
}

if (require.main === module) {
  main();
}
