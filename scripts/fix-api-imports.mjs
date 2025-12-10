#!/usr/bin/env node
// scripts/fix-api-imports.mjs
//
// Add `.js` to relative imports in services/api-gateway/src/**/*.ts
// Only touches paths starting with ./ or ../ and with NO extension yet.
//
// Example:
//   import { foo } from "../schema/period";
// becomes:
//   import { foo } from "../schema/period.js";

import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const targetDir = path.join(rootDir, "services", "api-gateway", "src");

const exts = [".ts", ".tsx"];

// Matches: from "./something" or from "../foo/bar"
// but NOT if the last segment already has a dot (e.g. ".js", ".json")
const RELATIVE_IMPORT_RE_DOUBLE =
  /from\s+"(\.\.?(?:\/[^"'.]+)+)"/g;
const RELATIVE_IMPORT_RE_SINGLE =
  /from\s+'(\.\.?(?:\/[^"'.]+)+)'/g;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function fixFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let updated = original;

  updated = updated.replace(
    RELATIVE_IMPORT_RE_DOUBLE,
    (match, p1) => `from "${p1}.js"`
  );

  updated = updated.replace(
    RELATIVE_IMPORT_RE_SINGLE,
    (match, p1) => `from '${p1}.js'`
  );

  if (updated !== original) {
    console.log(`Updated imports in ${path.relative(rootDir, filePath)}`);
    fs.writeFileSync(filePath, updated, "utf8");
  }
}

if (!fs.existsSync(targetDir)) {
  console.error(`Target dir not found: ${targetDir}`);
  process.exit(1);
}

const files = walk(targetDir);
for (const file of files) {
  fixFile(file);
}
