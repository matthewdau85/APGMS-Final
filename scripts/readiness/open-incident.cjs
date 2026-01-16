#!/usr/bin/env node
/**
 * scripts/readiness/open-incident.cjs
 *
 * Readiness check for incident tooling + a lightweight "open incident" helper.
 *
 * Behavior:
 *   - Default (no args): readiness check only (does NOT create anything).
 *   - --init: creates status/incidents and a .gitkeep if missing.
 *   - --new "<title>": creates a new markdown incident stub in status/incidents.
 *
 * Notes:
 *   - Preferred incident directory: status/incidents
 *   - Legacy dir: incidents (discouraged)
 */

const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const repoRoot = path.resolve(__dirname, "../..");
const preferredDir = path.join(repoRoot, "status", "incidents");
const legacyDir = path.join(repoRoot, "incidents");

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "incident";
}

function ymd() {
  const d = new Date();
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ensureDir() {
  fs.mkdirSync(preferredDir, { recursive: true });
  const keep = path.join(preferredDir, ".gitkeep");
  if (!fs.existsSync(keep)) fs.writeFileSync(keep, "", "utf-8");
}

function readinessCheck() {
  if (fs.existsSync(legacyDir) && !fs.existsSync(preferredDir)) {
    console.warn(`[incident] NOTE: legacy folder exists but preferred location is missing: ${legacyDir}`);
    console.warn("[incident] Preferred location is status/incidents.");
    return 2;
  }

  if (fs.existsSync(legacyDir)) {
    console.warn(`[incident] NOTE: legacy folder exists but is not used: ${legacyDir}`);
    console.warn("[incident] Preferred location is status/incidents.");
  }

  if (!fs.existsSync(preferredDir)) {
    console.warn(`[incident] AMBER: preferred incident directory missing: ${preferredDir}`);
    console.warn("[incident] Run: node ./scripts/readiness/open-incident.cjs --init");
    return 2;
  }

  console.log("[incident] OK - incident tooling present.");
  return 0;
}

function createNew(title) {
  ensureDir();
  const stamp = ymd();
  const slug = slugify(title);
  const file = path.join(preferredDir, `${stamp}-${slug}.md`);
  if (fs.existsSync(file)) {
    console.error(`[incident] File already exists: ${file}`);
    process.exit(1);
  }
  const body = [
    `# Incident: ${title}`,
    "",
    `Date: ${stamp}`,
    "",
    "## Summary",
    "- What happened?",
    "",
    "## Impact",
    "- Who/what was affected?",
    "",
    "## Timeline (AEST)",
    "- HH:MM - Event",
    "",
    "## Root cause",
    "- ",
    "",
    "## Mitigations",
    "- ",
    "",
    "## Follow-ups",
    "- ",
    "",
  ].join("\n");
  fs.writeFileSync(file, body, "utf-8");
  console.log(`[incident] Created: ${file}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--init")) {
    ensureDir();
    console.log(`[incident] Initialized: ${preferredDir}`);
    process.exit(0);
  }

  const newIdx = args.indexOf("--new");
  if (newIdx !== -1) {
    const title = args[newIdx + 1];
    if (!title) {
      console.error("[incident] --new requires a title string.");
      process.exit(1);
    }
    createNew(title);
    process.exit(0);
  }

  const code = readinessCheck();
  process.exit(code);
}

main().catch((err) => {
  console.error("[incident] Unexpected error:", err && err.stack ? err.stack : String(err));
  process.exit(1);
});
