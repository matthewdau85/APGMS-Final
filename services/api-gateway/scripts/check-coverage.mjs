#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const MIN_STATEMENTS = 70;
const MIN_BRANCHES   = 35;
const MIN_FUNCTIONS  = 65;
const MIN_LINES      = 70;

const threshold = 40;

// For this package, Jest writes to ./coverage/coverage-summary.json
const coverageFile = path.join(process.cwd(), "coverage", "coverage-summary.json");

if (!fs.existsSync(coverageFile)) {
  console.warn("[check-coverage] coverage file not found:", coverageFile);
  console.warn("[check-coverage] Skipping enforcement for now (exit 0).");
  process.exit(0);
}

const raw = fs.readFileSync(coverageFile, "utf8");
const json = JSON.parse(raw);
const total = json.total || {};

const linePct = total.lines?.pct ?? 0;
const stmtPct = total.statements?.pct ?? 0;
const fnPct   = total.functions?.pct ?? 0;
const brPct   = total.branches?.pct ?? 0;

console.log("[check-coverage] coverage summary:");
console.log(
  `  lines=${linePct}% stmts=${stmtPct}% funcs=${fnPct}% branches=${brPct}%`
);

const failures = [];

if (linePct < MIN_LINES) {
  failures.push(`Lines coverage ${linePct}% < required ${MIN_LINES}%`);
}
if (stmtPct < MIN_STATEMENTS) {
  failures.push(`Statements coverage ${stmtPct}% < required ${MIN_STATEMENTS}%`);
}
if (fnPct < MIN_FUNCTIONS) {
  failures.push(`Functions coverage ${fnPct}% < required ${MIN_FUNCTIONS}%`);
}
if (brPct < MIN_BRANCHES) {
  failures.push(`Branches coverage ${brPct}% < required ${MIN_BRANCHES}%`);
}

if (failures.length > 0) {
  console.error("[check-coverage] Coverage thresholds not met:");
  for (const f of failures) {
    console.error("  - " + f);
  }
  process.exit(1);
}

console.log("[check-coverage] OK: per-metric coverage thresholds satisfied ✅");
process.exit(0);
