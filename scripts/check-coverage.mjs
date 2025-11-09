#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const COVERAGE_FILE = resolve(process.cwd(), "coverage/coverage-summary.json");
const COVERAGE_THRESHOLD = Number(process.env.COVERAGE_THRESHOLD ?? 85);

async function readCoverageSummary() {
  try {
    const raw = await readFile(COVERAGE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read coverage summary at ${COVERAGE_FILE}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function extractMetric(summary, key) {
  const section = summary?.total?.[key];
  if (!section || typeof section.pct !== "number") {
    console.error(`Coverage summary missing required metric: ${key}`);
    process.exit(1);
  }
  return section.pct;
}

function formatMetric(name, value) {
  return `${name}: ${value.toFixed(2)}%`;
}

async function main() {
  const summary = await readCoverageSummary();
  const metrics = {
    lines: extractMetric(summary, "lines"),
    statements: extractMetric(summary, "statements"),
    branches: extractMetric(summary, "branches"),
    functions: extractMetric(summary, "functions"),
  };

  const failures = Object.entries(metrics).filter(([, pct]) => pct < COVERAGE_THRESHOLD);

  const formattedMetrics = Object.entries(metrics)
    .map(([name, pct]) => formatMetric(name, pct))
    .join(", ");

  console.log(`Coverage results → ${formattedMetrics}`);
  console.log(`Required minimum: ${COVERAGE_THRESHOLD}%`);

  if (failures.length > 0) {
    const failedMetrics = failures
      .map(([name, pct]) => `${name} (${pct.toFixed(2)}%)`)
      .join(", ");
    console.error(`Coverage check failed for: ${failedMetrics}`);
    process.exit(1);
  }

  console.log("✅ Coverage threshold met");
}

main().catch((error) => {
  console.error("Unexpected error while checking coverage:");
  console.error(error);
  process.exit(1);
});
