#!/usr/bin/env node
"use strict";

/**
 * scripts/readiness/run-k6-smoke.cjs
 *
 * Generates a fresh k6 summary export at k6/smoke-summary.json.
 *
 * Strategy:
 *   1) If k6 binary exists, run it directly (BASE_URL defaults to http://localhost:3000).
 *   2) Else, if Docker exists, run grafana/k6 container (BASE_URL defaults to http://host.docker.internal:3000).
 *   3) Else, AMBER.
 *
 * Inputs:
 *   K6_SMOKE_SCRIPT (default: ./k6/smoke.js)
 *   K6_SUMMARY_PATH (default: ./k6/smoke-summary.json)
 *   K6_BASE_URL (optional; forwarded to k6 via env var BASE_URL)
 *
 * Exit codes:
 *   0 = GREEN (generated)
 *   2 = AMBER (cannot run k6 locally)
 *   1 = RED (k6 ran but failed)
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const scriptPath = path.resolve(
  repoRoot,
  process.env.K6_SMOKE_SCRIPT || path.join("k6", "smoke.js")
);
const summaryPath = path.resolve(
  repoRoot,
  process.env.K6_SUMMARY_PATH || path.join("k6", "smoke-summary.json")
);

function have(cmd) {
  const res = spawnSync(cmd, ["--version"], { stdio: "ignore" });
  return res.status === 0;
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function baseUrlForDirect() {
  return process.env.K6_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
}

function baseUrlForDocker() {
  return (
    process.env.K6_BASE_URL ||
    process.env.BASE_URL ||
    "http://host.docker.internal:3000"
  );
}

function runK6Direct() {
  ensureDirFor(summaryPath);
  const res = spawnSync(
    "k6",
    ["run", "--summary-export", summaryPath, scriptPath],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, BASE_URL: baseUrlForDirect() },
    }
  );
  return typeof res.status === "number" ? res.status : 1;
}

function runK6ViaDocker() {
  ensureDirFor(summaryPath);

  const scriptRel = path.relative(repoRoot, scriptPath).replace(/\\/g, "/");
  const summaryRel = path.relative(repoRoot, summaryPath).replace(/\\/g, "/");

  const res = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `BASE_URL=${baseUrlForDocker()}`,
      "-v",
      `${repoRoot}:/work`,
      "-w",
      "/work",
      "grafana/k6:latest",
      "run",
      "--summary-export",
      summaryRel,
      scriptRel,
    ],
    { cwd: repoRoot, stdio: "inherit", env: { ...process.env } }
  );

  return typeof res.status === "number" ? res.status : 1;
}

function main() {
  console.log(`[run-k6-smoke] smoke script: ${scriptPath}`);
  console.log(`[run-k6-smoke] summary out:  ${summaryPath}`);

  if (!fs.existsSync(scriptPath)) {
    console.log("[run-k6-smoke] RED: smoke script not found.");
    process.exit(1);
  }

  if (have("k6")) {
    console.log(
      `[run-k6-smoke] Using local k6 binary (BASE_URL=${baseUrlForDirect()}).`
    );
    const code = runK6Direct();
    if (code === 0) process.exit(0);
    console.log("[run-k6-smoke] RED: k6 exited non-zero.");
    process.exit(1);
  }

  if (have("docker")) {
    console.log(
      `[run-k6-smoke] Local k6 not found; using Docker grafana/k6:latest (BASE_URL=${baseUrlForDocker()}).`
    );
    const code = runK6ViaDocker();
    if (code === 0) process.exit(0);
    console.log("[run-k6-smoke] RED: docker k6 exited non-zero.");
    process.exit(1);
  }

  console.log(
    "[run-k6-smoke] AMBER: neither k6 nor docker is available to generate a k6 summary."
  );
  process.exit(2);
}

try {
  main();
} catch (err) {
  console.error(
    "[run-k6-smoke] Unexpected error:",
    err && err.stack ? err.stack : String(err)
  );
  process.exit(1);
}
