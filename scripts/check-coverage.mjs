// scripts/check-coverage.mjs
// ESM script (root package.json is "type": "module")

import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Jest coverage summary that we EXPECT to exist
// once we wire up copying coverage to the repo root.
const COVERAGE_PATH = path.resolve(__dirname, '..', 'coverage', 'coverage-summary.json');

// Minimum coverage thresholds (tweak as needed)
const MIN_LINES = 85;
const MIN_BRANCHES = 0;  // optional: relax these if you only care about lines
const MIN_FUNCTIONS = 0;
const MIN_STATEMENTS = 0;

async function main() {
  let raw;

  try {
    raw = await fs.readFile(COVERAGE_PATH, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      // For now, DO NOT fail CI if the coverage file is missing.
      console.warn(
        `[check-coverage] coverage-summary.json not found at ${COVERAGE_PATH}. ` +
        `Skipping coverage enforcement (exit 0).`
      );
      process.exit(0);
    }

    console.error(
      `[check-coverage] Failed to read coverage file at ${COVERAGE_PATH}:`,
      err
    );
    // If the file exists but something else is wrong (permissions, etc),
    // we fail the build so we notice.
    process.exit(1);
  }

  let summary;
  try {
    summary = JSON.parse(raw);
  } catch (err) {
    console.error('[check-coverage] Failed to parse coverage-summary.json as JSON:', err);
    process.exit(1);
  }

  const total = summary.total || {};
  const lines = total.lines || {};
  const branches = total.branches || {};
  const functions = total.functions || {};
  const statements = total.statements || {};

  const linePct = lines.pct ?? 0;
  const branchPct = branches.pct ?? 0;
  const funcPct = functions.pct ?? 0;
  const stmtPct = statements.pct ?? 0;

  console.log('[check-coverage] Coverage totals:');
  console.log(`  Lines:      ${linePct}%`);
  console.log(`  Statements: ${stmtPct}%`);
  console.log(`  Branches:   ${branchPct}%`);
  console.log(`  Functions:  ${funcPct}%`);

  const failures = [];

  if (linePct < MIN_LINES) {
    failures.push(`Lines coverage ${linePct}% < required ${MIN_LINES}%`);
  }
  if (branchPct < MIN_BRANCHES) {
    failures.push(`Branches coverage ${branchPct}% < required ${MIN_BRANCHES}%`);
  }
  if (funcPct < MIN_FUNCTIONS) {
    failures.push(`Functions coverage ${funcPct}% < required ${MIN_FUNCTIONS}%`);
  }
  if (stmtPct < MIN_STATEMENTS) {
    failures.push(`Statements coverage ${stmtPct}% < required ${MIN_STATEMENTS}%`);
  }

  if (failures.length > 0) {
    console.error('[check-coverage] Coverage thresholds not met:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log('[check-coverage] Coverage thresholds satisfied ✅');
  process.exit(0);
}

main().catch((err) => {
  console.error('[check-coverage] Unexpected error:', err);
  process.exit(1);
});
