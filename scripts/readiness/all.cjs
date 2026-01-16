#!/usr/bin/env node
"use strict";

/**
 * scripts/readiness/all.cjs
 *
 * Orchestrates all readiness pillars.
 *
 * Exit codes:
 *   0 = GREEN (all pillars green)
 *   2 = AMBER (no red, but at least one amber)
 *   1 = RED (at least one red)
 *
 * Controls:
 *   READINESS_SKIP_E2E=1
 *   READINESS_SKIP_LOG_SCAN=1
 *   READINESS_SKIP_INCIDENT=1
 *
 * Log scan:
 *   READINESS_LOG_PATH (default: ./logs)
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

function printHeader(title) {
  console.log("");
  console.log("=== " + title + " ===");
}

function runNodeScript(relPath, label, extraEnv) {
  return runCommand(
    process.execPath,
    [path.join(repoRoot, relPath)],
    label,
    extraEnv
  );
}

function runCommand(cmd, args, label, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });

    child.on("close", (code) => {
      const exitCode = typeof code === "number" ? code : 1;
      resolve({ label, code: exitCode });
    });
  });
}

function statusFromCode(code) {
  if (code === 0) return "GREEN";
  if (code === 2) return "AMBER";
  return "RED";
}

async function main() {
  const results = [];

  printHeader("Availability & Performance");
  results.push(
    await runNodeScript(
      "scripts/readiness/availability-and-performance.cjs",
      "Availability & Performance"
    )
  );

  if (process.env.READINESS_SKIP_E2E !== "1") {
    printHeader("E2E Smoke (Link + Controls)");
    results.push(
      await runNodeScript(
        "scripts/readiness/e2e-smoke.cjs",
        "E2E Smoke (Link + Controls)"
      )
    );
  }

  if (process.env.READINESS_SKIP_LOG_SCAN !== "1") {
    printHeader("Log Scan");
    const logPath = process.env.READINESS_LOG_PATH || "./logs";
    results.push(
      await runNodeScript("scripts/readiness/log-scan.cjs", "Log Scan", {
        READINESS_LOG_PATH: logPath,
      })
    );
  }

  if (process.env.READINESS_SKIP_INCIDENT !== "1") {
    printHeader("Incident Tooling");
    results.push(
      await runNodeScript(
        "scripts/readiness/incident-tooling.cjs",
        "Incident Tooling"
      )
    );
  }

  console.log("");
  console.log("========================");
  console.log("Readiness summary");
  console.log("========================");

  const amber = [];
  const red = [];

  for (const r of results) {
    const status = statusFromCode(r.code);
    if (status === "AMBER") amber.push(r.label);
    if (status === "RED") red.push(r.label);
    console.log(`${status}: ${r.label}`);
  }

  console.log("");

  if (red.length > 0) {
    console.log("READINESS: RED - blockers detected.");
    process.exit(1);
  }

  if (amber.length > 0) {
    console.log("READINESS: AMBER - issues detected.");
    process.exit(2);
  }

  console.log("READINESS: GREEN - all pillars green.");
  process.exit(0);
}

main().catch((err) => {
  console.error(
    "[readiness] Unexpected error:",
    err && err.stack ? err.stack : String(err)
  );
  process.exit(1);
});
