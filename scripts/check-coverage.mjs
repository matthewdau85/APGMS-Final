#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const THRESHOLD = 80; // bump to 85 when you're ready

const targets = [
  "services/api-gateway/coverage/coverage-summary.json",
  // add more later, e.g.:
  // "packages/domain-policy/coverage/coverage-summary.json",
];

const found = [];

for (const rel of targets) {
  const full = path.join(process.cwd(), rel);
  if (fs.existsSync(full)) {
    found.push(full);
  } else {
    console.warn(`[check-coverage] Missing coverage file: ${rel}`);
  }
}

if (found.length === 0) {
  console.warn(
    "[check-coverage] No coverage-summary.json files found; skipping enforcement (exit 0 for now)."
  );
  process.exit(0);
}

let worstPct = 100;
const details = [];

for (const full of found) {
  const raw = fs.readFileSync(full, "utf8");
  const json = JSON.parse(raw);
  const total = json.total;

  const linePct = total.lines?.pct ?? 0;
  const stmtPct = total.statements?.pct ?? 0;
  const fnPct = total.functions?.pct ?? 0;
  const brPct = total.branches?.pct ?? 0;

  const minPct = Math.min(linePct, stmtPct, fnPct, brPct);
  worstPct = Math.min(worstPct, minPct);

  details.push({
    file: full,
    linePct,
    stmtPct,
    fnPct,
    brPct,
    minPct,
  });
}

console.log("[check-coverage] Coverage summary:");
for (const d of details) {
  console.log(
    `  ${d.file}: lines=${d.linePct}% stmts=${d.stmtPct}% funcs=${d.fnPct}% branches=${d.brPct}% (min=${d.minPct}%)`
  );
}

if (worstPct < THRESHOLD) {
  console.error(
    `[check-coverage] FAIL: worst coverage ${worstPct}% is below threshold ${THRESHOLD}%`
  );
  process.exit(1);
}

console.log(
  `[check-coverage] OK: worst coverage ${worstPct}% >= threshold ${THRESHOLD}%`
);
process.exit(0);
