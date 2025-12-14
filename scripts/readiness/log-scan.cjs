#!/usr/bin/env node
/**
 * Readiness check: Log scan for unhandled rejections and retry storms
 *
 * - Reads the last N lines of a log file
 * - Looks for patterns indicating:
 *   - Unhandled promise rejections
 *   - Generic "unhandled" errors
 *   - Excessive retries
 *
 * Env:
 *   READINESS_LOG_PATH     (required)
 *   LOG_SCAN_MAX_LINES     (default: 2000)
 *   LOG_SCAN_MAX_UNHANDLED (default: 0)
 *   LOG_SCAN_MAX_RETRIES   (default: 20)
 */

const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

function tailLines(content, maxLines) {
  const lines = content.split(/\r?\n/);
  if (lines.length <= maxLines) return lines;
  return lines.slice(lines.length - maxLines);
}

function main() {
  const logPath = process.env.READINESS_LOG_PATH;
  if (!logPath) {
    console.warn("[log-scan] READINESS_LOG_PATH not set – skipping log scan");
    process.exit(0);
  }
  const abs = path.resolve(logPath);

  const maxLines = Number(process.env.LOG_SCAN_MAX_LINES || "2000");
  const maxUnhandled = Number(process.env.LOG_SCAN_MAX_UNHANDLED || "0");
  const maxRetries = Number(process.env.LOG_SCAN_MAX_RETRIES || "20");

  if (!fs.existsSync(abs)) {
    console.error("[log-scan] Log file not found:", abs);
    process.exit(1);
  }

  console.log("[log-scan] Scanning last", maxLines, "lines of", abs);

  const content = fs.readFileSync(abs, "utf8");
  const lines = tailLines(content, maxLines);

  const unhandledPatterns = [
    /UnhandledPromiseRejection/i,
    /unhandled rejection/i,
    /unhandled error/i,
    /uncaught exception/i,
  ];

  const retryPatterns = [
    /retrying/i,
    /retry attempt/i,
    /will retry/i,
  ];

  let unhandledCount = 0;
  let retryCount = 0;

  for (const line of lines) {
    if (!line) continue;
    if (unhandledPatterns.some((re) => re.test(line))) {
      unhandledCount++;
    }
    if (retryPatterns.some((re) => re.test(line))) {
      retryCount++;
    }
  }

  console.log("[log-scan] Counts:");
  console.log("  unhandled:", unhandledCount);
  console.log("  retries:  ", retryCount);

  let ok = true;

  if (unhandledCount > maxUnhandled) {
    console.error(
      `[log-scan] FAIL – unhandled count ${unhandledCount} > max ${maxUnhandled}`
    );
    ok = false;
  }

  if (retryCount > maxRetries) {
    console.error(
      `[log-scan] FAIL – retry count ${retryCount} > max ${maxRetries}`
    );
    ok = false;
  }

  if (!ok) {
    process.exit(1);
  }

  console.log("[log-scan] OK – unhandled and retries within thresholds");
  process.exit(0);
}

if (require.main === module) {
  main();
}
