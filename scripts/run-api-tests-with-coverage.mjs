#!/usr/bin/env node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const threshold = Number.parseFloat(process.env.API_FUNCTION_COVERAGE_MIN ?? "0.8");

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(thisFile), "..");
const serviceDir = path.join(repoRoot, "services", "api-gateway");

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

const coverageDir = mkdtempSync(path.join(tmpdir(), "apgms-api-coverage-"));

const env = {
  ...process.env,
  NODE_V8_COVERAGE: coverageDir,
  TSX_PROJECT: path.join(serviceDir, "tsconfig.json"),
};

const run = spawnSync(
  process.execPath,
  ["--import", "tsx/esm", "--test", "test/index.test.ts"],
  {
    cwd: serviceDir,
    env,
    stdio: "inherit",
  }
);

if (run.status !== 0) {
  cleanup(coverageDir);
  process.exit(run.status ?? 1);
}

const coverageFiles = readdirSync(coverageDir).filter((file) => file.endsWith(".json"));
if (coverageFiles.length === 0) {
  console.error("No coverage files were produced by the API gateway test suite.");
  cleanup(coverageDir);
  process.exit(1);
}

let totalFunctions = 0;
let coveredFunctions = 0;

for (const file of coverageFiles) {
  const data = JSON.parse(readFileSync(path.join(coverageDir, file), "utf8"));
  for (const script of data.result ?? []) {
    const url = typeof script.url === "string" ? script.url : "";
    if (!url.startsWith("file://")) continue;
    if (!url.includes("/services/api-gateway/src/")) continue;

    for (const func of script.functions ?? []) {
      const ranges = func.ranges ?? [];
      if (ranges.length === 0) continue;
      totalFunctions += 1;
      if (ranges.some((range) => (range.count ?? 0) > 0)) {
        coveredFunctions += 1;
      }
    }
  }
}

cleanup(coverageDir);

if (totalFunctions === 0) {
  console.error("No API gateway source files were present in the coverage report.");
  process.exit(1);
}

const ratio = coveredFunctions / totalFunctions;
const percent = (ratio * 100).toFixed(2);
const thresholdPercent = (threshold * 100).toFixed(0);

if (ratio + Number.EPSILON < threshold) {
  console.error(
    `API gateway function coverage ${percent}% is below the required ${thresholdPercent}% threshold ` +
      `(${coveredFunctions}/${totalFunctions} functions exercised).`
  );
  process.exit(1);
}

console.log(
  `API gateway function coverage ${percent}% meets the required ${thresholdPercent}% threshold ` +
    `(${coveredFunctions}/${totalFunctions} functions exercised).`
);
