#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const thresholds = {
  lines: 85,
  statements: 85,
  functions: 85,
  branches: 85,
};

const summaryPath = resolve(process.cwd(), "coverage", "coverage-summary.json");

if (!existsSync(summaryPath)) {
  console.error("\u274c coverage/coverage-summary.json not found.\n" +
    "Run your test suite with coverage enabled (e.g. `pnpm coverage`) before enforcing coverage thresholds.");
  process.exit(1);
}

let summaryRaw;
try {
  summaryRaw = await readFile(summaryPath, "utf8");
} catch (error) {
  console.error(`\u274c Failed to read coverage summary at ${summaryPath}`);
  console.error(error);
  process.exit(1);
}

let summary;
try {
  summary = JSON.parse(summaryRaw);
} catch (error) {
  console.error("\u274c coverage-summary.json is not valid JSON.");
  console.error(error);
  process.exit(1);
}

const total = summary.total;
if (!total) {
  console.error("\u274c coverage-summary.json is missing the expected 'total' field.");
  process.exit(1);
}

const failures = [];
for (const [metric, threshold] of Object.entries(thresholds)) {
  const coverage = total[metric]?.pct;
  if (typeof coverage !== "number") {
    failures.push(`${metric}: missing`);
    continue;
  }
  if (coverage < threshold) {
    failures.push(`${metric}: ${coverage.toFixed(2)}% (required: ${threshold}%)`);
  }
}

if (failures.length > 0) {
  console.error("\u274c Coverage thresholds not met:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("\u2705 Coverage thresholds met:");
for (const [metric, threshold] of Object.entries(thresholds)) {
  const coverage = total[metric]?.pct ?? 0;
  console.log(`  - ${metric}: ${coverage.toFixed(2)}% (required: ${threshold}%)`);
}
