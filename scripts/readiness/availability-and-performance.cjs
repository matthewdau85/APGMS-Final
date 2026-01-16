#!/usr/bin/env node
"use strict";

/**
 * scripts/readiness/availability-and-performance.cjs
 *
 * Availability & Performance pillar:
 *   - availability.cjs (checks /ready)
 *   - k6-summary.cjs (parses k6/smoke-summary.json)
 *
 * Behavior:
 *   - If k6 summary is missing/partial, tries to regenerate it via run-k6-smoke.cjs.
 *
 * Exit codes:
 *   0 = GREEN
 *   2 = AMBER
 *   1 = RED
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

function runNode(relPath, extraEnv) {
  const p = path.join(repoRoot, relPath);
  const res = spawnSync(process.execPath, [p], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  return typeof res.status === "number" ? res.status : 1;
}

function isGreen(code) {
  return code === 0;
}
function isAmber(code) {
  return code === 2;
}
function isRed(code) {
  return !isGreen(code) && !isAmber(code);
}

function main() {
  console.log("=== AVAILABILITY & PERFORMANCE PILLAR ===");

  const availabilityCode = runNode("scripts/readiness/availability.cjs");
  if (isRed(availabilityCode)) {
    console.log("=== AVAILABILITY & PERFORMANCE: RED (availability) ===");
    process.exit(1);
  }

  let k6Code = runNode("scripts/readiness/k6-summary.cjs");

  if (isAmber(k6Code)) {
    console.log(
      "[availability-and-performance] k6 summary missing/partial; attempting to regenerate via run-k6-smoke.cjs"
    );
    const regenCode = runNode("scripts/readiness/run-k6-smoke.cjs");
    if (isRed(regenCode)) {
      console.log("=== AVAILABILITY & PERFORMANCE: RED (k6 smoke) ===");
      process.exit(1);
    }
    k6Code = runNode("scripts/readiness/k6-summary.cjs");
  }

  if (isRed(k6Code)) {
    console.log("=== AVAILABILITY & PERFORMANCE: RED (k6) ===");
    process.exit(1);
  }

  if (isAmber(availabilityCode) || isAmber(k6Code)) {
    console.log("=== AVAILABILITY & PERFORMANCE: AMBER ===");
    process.exit(2);
  }

  console.log("=== AVAILABILITY & PERFORMANCE: GREEN ===");
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(
    "[availability-and-performance] Unexpected error:",
    err && err.stack ? err.stack : String(err)
  );
  process.exit(1);
}
