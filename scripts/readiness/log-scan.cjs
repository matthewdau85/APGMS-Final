#!/usr/bin/env node
"use strict";

/**
 * scripts/readiness/log-scan.cjs
 *
 * Scans recent log files for high-signal error patterns.
 *
 * Inputs:
 *   READINESS_LOG_PATH (file or directory; default: ./logs)
 *   READINESS_LOG_MAX_FILES (default: 200)
 *   READINESS_LOG_MAX_DAYS (default: 14)
 *   READINESS_LOG_TAIL_BYTES (default: 200000)
 *
 * Exit codes:
 *   0 = GREEN (no suspicious patterns)
 *   2 = AMBER (no logs to scan / path missing)
 *   1 = RED (suspicious patterns found)
 */

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

const inputPath = process.env.READINESS_LOG_PATH
  ? path.resolve(repoRoot, process.env.READINESS_LOG_PATH)
  : path.resolve(repoRoot, "logs");

const maxFiles = Number(process.env.READINESS_LOG_MAX_FILES || 200);
const maxDays = Number(process.env.READINESS_LOG_MAX_DAYS || 14);
const tailBytes = Number(process.env.READINESS_LOG_TAIL_BYTES || 200000);

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listFilesRecursive(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile()) out.push(p);
    }
  }
  return out;
}

function recentEnough(filePath) {
  try {
    const st = fs.statSync(filePath);
    const ageMs = Date.now() - st.mtimeMs;
    return ageMs <= maxDays * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function readTail(filePath) {
  const st = fs.statSync(filePath);
  const size = st.size;
  const start = Math.max(0, size - tailBytes);
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString("utf-8");
  } finally {
    fs.closeSync(fd);
  }
}

const SUSPICIOUS = [
  { name: "UNHANDLED_REJECTION", re: /UnhandledPromiseRejection/i },
  { name: "UNCAUGHT_EXCEPTION", re: /uncaught exception/i },
  { name: "ECONNREFUSED", re: /ECONNREFUSED/i },
  { name: "ELIFECYCLE", re: /ELIFECYCLE/i },
  { name: "NODE_FATAL", re: /\bFATAL\b(?=[:\]\s])/i },
  { name: "ERROR_PREFIX", re: /(^|\n)\s*Error:\s+/i },
  { name: "TYPEERROR", re: /\bTypeError:\s+/i },
  { name: "REFERENCEERROR", re: /\bReferenceError:\s+/i },
];

const IGNORE_LINE = [
  /log level \(trace, debug, info, warn, error, fatal\)/i,
  /^\s*(Usage:|Options:|Global Flags:)/i,
];

function lineIsIgnorable(line) {
  return IGNORE_LINE.some((re) => re.test(line));
}

function scanText(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (lineIsIgnorable(line)) continue;

    for (const p of SUSPICIOUS) {
      if (p.re.test(line)) {
        hits.push({ pattern: p.name, lineNo: i + 1, line });
      }
    }
  }
  return hits;
}

function main() {
  console.log("=== LOG SCAN PILLAR ===");
  console.log("[log-scan] Starting log scan.");
  console.log(`[log-scan] Path: ${inputPath}`);

  let files = [];

  if (isFile(inputPath)) {
    files = [inputPath];
  } else if (isDir(inputPath)) {
    files = listFilesRecursive(inputPath)
      .filter(
        (p) =>
          /\.(log|txt|out)$/i.test(p) ||
          /local-ci-|readiness-|ci-/i.test(path.basename(p))
      )
      .filter(recentEnough);
  } else {
    console.log("[log-scan] AMBER: log path does not exist or is not accessible.");
    process.exit(2);
  }

  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (files.length === 0) {
    console.log("[log-scan] AMBER: no log files found to scan (after filtering).");
    process.exit(2);
  }

  const capped = files.slice(0, maxFiles);
  console.log(`[log-scan] Candidate log files: ${capped.length} (cap ${maxFiles})`);

  const findings = [];

  for (const f of capped) {
    let text = "";
    try {
      text = readTail(f);
    } catch {
      continue;
    }
    const hits = scanText(text);
    if (hits.length > 0) findings.push({ file: f, hits: hits.slice(0, 10) });
  }

  if (findings.length === 0) {
    console.log("[log-scan] GREEN: no suspicious patterns found.");
    process.exit(0);
  }

  console.log("[log-scan] RED: suspicious patterns found:");
  for (const f of findings) {
    console.log("");
    console.log("File: " + f.file);
    for (const h of f.hits) {
      console.log(`  [${h.pattern}] line ${h.lineNo}: ${h.line}`);
    }
  }

  console.log("");
  console.log("[log-scan] Tip: set READINESS_LOG_PATH to a directory containing only the logs you want scanned.");
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error("[log-scan] Unexpected error:", err && err.stack ? err.stack : String(err));
  process.exit(1);
}
