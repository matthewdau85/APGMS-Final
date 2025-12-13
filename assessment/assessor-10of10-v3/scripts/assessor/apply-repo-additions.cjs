"use strict";

/**
 * Copies the repo-additions templates into the repo root.
 * By default it will NOT overwrite existing files.
 *
 * Usage (from repo root):
 *   node assessment/assessor-10of10-v3/scripts/assessor/apply-repo-additions.cjs
 *   node assessment/assessor-10of10-v3/scripts/assessor/apply-repo-additions.cjs --force
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = true;
  }
  return out;
}

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const force = Boolean(args.force);

  const repoRoot = process.cwd();
  const assessorRoot = path.resolve(__dirname, "..", "..");
  const srcRoot = path.join(assessorRoot, "repo-additions");

  if (!fs.existsSync(srcRoot)) {
    console.error(`repo-additions not found: ${srcRoot}`);
    process.exit(2);
  }

  const files = walk(srcRoot);
  let copied = 0;
  let skipped = 0;

  for (const src of files) {
    const rel = path.relative(srcRoot, src);
    const dst = path.join(repoRoot, rel);

    const dstDir = path.dirname(dst);
    fs.mkdirSync(dstDir, { recursive: true });

    if (fs.existsSync(dst) && !force) {
      skipped++;
      continue;
    }
    fs.copyFileSync(src, dst);
    copied++;
  }

  console.log(`apply-repo-additions: copied=${copied} skipped=${skipped} force=${force}`);
}

main();
