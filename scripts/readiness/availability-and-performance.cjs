#!/usr/bin/env node
/**
 * Aggregate Availability & Performance pillar check.
 *
 * Runs:
 *   - availability.cjs
 *   - k6-summary.cjs
 *   - log-scan.cjs
 *
 * Prints a pillar-level GREEN / RED and exits non-zero on failure.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");
const process = require("node:process");

function runScript(relPath, label) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(__dirname, relPath);
    const child = spawn("node", [scriptPath], {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });

    child.on("exit", (code) => {
      const ok = code === 0;
      if (!ok) {
        console.error(`[availability-and-performance] ${label} FAILED with code ${code}`);
      } else {
        console.log(`[availability-and-performance] ${label} OK`);
      }
      resolve({ label, ok, code });
    });
  });
}

async function main() {
  console.log("=== AVAILABILITY & PERFORMANCE PILLAR ===");

  const results = [];
  results.push(await runScript("./availability.cjs", "availability"));
  results.push(await runScript("./k6-summary.cjs", "k6-summary"));
  results.push(await runScript("./log-scan.cjs", "log-scan"));

  const failing = results.filter((r) => !r.ok);

  if (failing.length === 0) {
    console.log("=== AVAILABILITY & PERFORMANCE: GREEN ===");
    process.exit(0);
  }

  console.error("=== AVAILABILITY & PERFORMANCE: RED ===");
  for (const f of failing) {
    console.error(` - ${f.label} failed (exit code ${f.code})`);
  }
  process.exit(1);
}

if (require.main === module) {
  main();
}
