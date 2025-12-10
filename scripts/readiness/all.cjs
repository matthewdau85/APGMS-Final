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

async function main() {
  console.log("=== GLOBAL READINESS CHECK (ALL PILLARS) ===");

  const results = [];

  // For now we only have one pillar wired up
  results.push(
    await runNodeScript("./availability-and-performance.cjs", "Availability & Performance")
  );

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
