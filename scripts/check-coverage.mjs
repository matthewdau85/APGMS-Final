#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const COVERAGE_FILE = resolve(process.cwd(), 'coverage', 'coverage-summary.json');
const REQUIRED_PERCENT = 85;

async function loadCoverageSummary() {
  try {
    const raw = await readFile(COVERAGE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    throw new Error(`Unable to read coverage summary at ${COVERAGE_FILE}: ${message}`);
  }
}

function extractMetric(summary, key) {
  if (!summary || typeof summary !== 'object' || !summary.total) {
    throw new Error('Malformed coverage summary: missing total metrics');
  }

  const metric = summary.total[key];
  if (!metric || typeof metric.pct !== 'number') {
    throw new Error(`Malformed coverage summary: missing ${key} coverage percentage`);
  }

  return metric.pct;
}

function formatFailureMessage(linesPct, branchesPct) {
  return [
    'Test coverage below required threshold.',
    `Required: ${REQUIRED_PERCENT}% lines & branches`,
    `Actual: lines=${linesPct.toFixed(2)}%, branches=${branchesPct.toFixed(2)}%`,
  ].join('\n');
}

async function main() {
  const summary = await loadCoverageSummary();
  const linesPct = extractMetric(summary, 'lines');
  const branchesPct = extractMetric(summary, 'branches');

  if (linesPct < REQUIRED_PERCENT || branchesPct < REQUIRED_PERCENT) {
    console.error(formatFailureMessage(linesPct, branchesPct));
    process.exit(1);
  }

  console.log(`Coverage gate passed: lines=${linesPct.toFixed(2)}%, branches=${branchesPct.toFixed(2)}%`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
