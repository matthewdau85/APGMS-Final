#!/usr/bin/env node
/**
 * Create a new incident file in status/incidents/ based on _template.md.
 *
 * Args (CLI):
 *   --pillars="Availability & Performance, Security"
 *   --summary="Availability pillar failed due to k6 p95 breach"
 *   --script="readiness:all"
 */

const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      const key = arg.slice(2);
      args[key] = "";
    } else {
      const key = arg.slice(2, eq);
      const value = arg.slice(eq + 1);
      args[key] = value;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);

  const pillars = args.pillars || "Unknown";
  const summary = args.summary || "Readiness check failed – summary not provided.";
  const scriptName = args.script || "readiness:all";

  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");

  const incidentId = `${stamp}-${scriptName.replace(/[^a-zA-Z0-9]+/g, "-")}`;

  const incidentsDir = path.resolve("status", "incidents");
  const templatePath = path.join(incidentsDir, "_template.md");

  if (!fs.existsSync(incidentsDir)) {
    fs.mkdirSync(incidentsDir, { recursive: true });
  }

  if (!fs.existsSync(templatePath)) {
    console.warn("[open-incident] Template not found; creating minimal incident file.");
  }

  let template = "";
  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, "utf8");
  } else {
    template = `# Incident: {{INCIDENT_ID}}\n\n{{SUMMARY}}\n`;
  }

  const openedAt = now.toISOString();

  const content = template
    .replace(/{{INCIDENT_ID}}/g, incidentId)
    .replace(/{{OPENED_AT}}/g, openedAt)
    .replace(/{{PILLARS}}/g, pillars)
    .replace(/{{SCRIPT_NAME}}/g, scriptName)
    .replace(/{{SUMMARY}}/g, summary);

  const filePath = path.join(incidentsDir, `${incidentId}.md`);

  fs.writeFileSync(filePath, content, "utf8");

  console.log("[open-incident] Created incident file:", filePath);
}

if (require.main === module) {
  main();
}
