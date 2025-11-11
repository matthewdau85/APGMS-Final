import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const COVERAGE_FILE = resolve(process.cwd(), 'coverage', 'coverage-summary.json');
const THRESHOLD = Number(process.env.COVERAGE_THRESHOLD ?? '85');

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  let contents;
  try {
    contents = await readFile(COVERAGE_FILE, 'utf8');
  } catch (error) {
    fail(`Unable to read coverage file at ${COVERAGE_FILE}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    fail(`coverage-summary.json is invalid JSON: ${error.message}`);
  }

  const total = parsed?.total;
  if (!total) {
    fail('coverage-summary.json missing total block');
  }

  const candidates = [];
  for (const key of ['lines', 'statements']) {
    const pct = Number(total[key]?.pct);
    if (!Number.isFinite(pct)) continue;
    candidates.push({ label: key, pct });
  }

  if (candidates.length === 0) {
    fail('coverage-summary.json missing lines/statements coverage percentages');
  }

  const lowest = candidates.reduce((acc, current) => (current.pct < acc.pct ? current : acc));
  console.log(`Coverage low-watermark: ${lowest.label} ${lowest.pct.toFixed(2)}% (threshold ${THRESHOLD}%)`);

  if (lowest.pct < THRESHOLD) {
    fail(`Coverage ${lowest.label} ${lowest.pct.toFixed(2)}% is below threshold ${THRESHOLD}%`);
  }
}

main().catch((error) => {
  console.error('coverage gate failed', error);
  process.exit(1);
});
