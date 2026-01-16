#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log("=== INCIDENT TOOLING PILLAR ===");

  const repoRoot = path.resolve(process.cwd());
  const statusIncidentsDir = path.join(repoRoot, "status", "incidents");
  const templatePath = path.join(statusIncidentsDir, "_template.md");

  if (!exists(statusIncidentsDir)) {
    console.error(`[incident] Missing incidents folder: ${statusIncidentsDir}`);
    console.error("[incident] Create it and commit status/incidents/_template.md (preferred).");
    process.exit(1);
  }

  if (!exists(templatePath)) {
    console.error(`[incident] Missing incident template: ${templatePath}`);
    console.error("[incident] Create it (or restore it) so open-incident.cjs can stamp incidents consistently.");
    process.exit(1);
  }

  // Optional hygiene: root-level /incidents is not used by your current incident system.
  const legacyDir = path.join(repoRoot, "incidents");
  if (exists(legacyDir)) {
    console.log(`[incident] NOTE: legacy folder exists but is not used: ${legacyDir}`);
    console.log("[incident] Preferred location is status/incidents.");
  }

  console.log("[incident] OK - incident tooling present.");
  process.exit(0);
}

main();
