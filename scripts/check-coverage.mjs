#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const MINIMUM = 85;
const thresholds = {
  lines: MINIMUM,
  statements: MINIMUM,
  branches: MINIMUM,
  functions: MINIMUM,
};

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (
      entry.isFile() &&
      entry.name === "coverage-summary.json" &&
      path.basename(path.dirname(fullPath)) === "coverage"
    ) {
      yield fullPath;
    }
  }
}

async function loadSummaries(root) {
  const summaries = [];
  for await (const filePath of walk(root)) {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    const total = json.total;
    if (!total) {
      continue;
    }
    summaries.push({ filePath, total });
  }
  return summaries;
}

function formatPct(pct) {
  return `${pct.toFixed(2)}%`;
}

function checkSummary(summary) {
  const failures = [];
  for (const [metric, minPct] of Object.entries(thresholds)) {
    const data = summary.total[metric];
    if (!data) {
      failures.push(`${metric}: missing`);
      continue;
    }
    const pct = typeof data.pct === "number" ? data.pct : Number.NaN;
    if (!Number.isFinite(pct)) {
      failures.push(`${metric}: invalid pct`);
      continue;
    }
    if (pct < minPct) {
      failures.push(`${metric}: ${formatPct(pct)} (< ${minPct}%)`);
    }
  }
  return failures;
}

const root = process.cwd();
const summaries = await loadSummaries(root);

if (summaries.length === 0) {
  console.error("No coverage summaries found. Ensure tests ran with --coverage before invoking this script.");
  process.exit(1);
}

let hasFailure = false;
for (const summary of summaries) {
  const failures = checkSummary(summary);
  if (failures.length > 0) {
    hasFailure = true;
    console.error(`Coverage below threshold in ${path.relative(root, summary.filePath)}:`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
  }
}

if (hasFailure) {
  process.exit(1);
}

for (const summary of summaries) {
  console.log(`✔ Coverage OK for ${path.relative(root, summary.filePath)}`);
}
