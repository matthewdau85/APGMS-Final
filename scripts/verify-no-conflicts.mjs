#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const markers = [
  { pattern: "<<<<<<< ", label: "conflict start" },
  { pattern: "======= ", label: "conflict middle" },
  { pattern: ">>>>>>> ", label: "conflict end" },
];

let hasConflicts = false;

for (const marker of markers) {
  const result = spawnSync("git", ["grep", "-n", marker.pattern, "--", "."], {
    stdio: hasConflicts ? "ignore" : "inherit",
  });

  if (result.status === 0) {
    hasConflicts = true;
    continue;
  }

  if (result.status === 1) {
    continue;
  }

  console.error("git grep failed to execute; please ensure git is available.");
  process.exit(result.status ?? 2);
}

if (hasConflicts) {
  console.error("Detected merge conflict markers. Please resolve them before continuing.");
  process.exit(1);
}

process.exit(0);
