#!/usr/bin/env node
/**
 * Parse a k6 --summary-export JSON and enforce basic thresholds:
 * - error rate from http_req_failed (rate)
 * - p95 latency from http_req_duration
 *
 * Exits:
 *  0 = OK
 *  2 = WARNING (summary present but required metrics missing / unexpected format)
 *  1 = FAIL (metrics found but thresholds exceeded)
 */

const fs = require("node:fs");
const path = require("node:path");

const SUMMARY_PATH =
  process.env.K6_SUMMARY_PATH ||
  path.join(process.cwd(), "k6", "smoke-summary.json");

const MAX_ERROR_RATE = Number(process.env.K6_MAX_ERROR_RATE || "0.01"); // 1%
const MAX_P95_MS = Number(process.env.K6_MAX_P95_MS || "500"); // 500ms

function die(msg, code) {
  console.error(msg);
  process.exit(code);
}

function firstN(arr, n) {
  return arr.slice(0, n);
}

function main() {
  console.log(`[k6-summary] Reading k6 summary from: ${SUMMARY_PATH}`);

  if (!fs.existsSync(SUMMARY_PATH)) {
    die("[k6-summary] ERROR: summary file not found.", 2);
  }

  let root;
  try {
    root = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"));
  } catch (e) {
    die("[k6-summary] ERROR: could not parse JSON.", 2);
  }

  if (!root || typeof root !== "object" || !root.metrics || typeof root.metrics !== "object") {
    die("[k6-summary] WARNING: summary JSON is not in k6 --summary-export format (missing root.metrics).", 2);
  }

  const metrics = root.metrics;
  const metricNames = Object.keys(metrics).sort();

  const errorMetricName = "http_req_failed";
  const latencyMetricName = "http_req_duration";

  console.log("[k6-summary] Selected metrics:");
  console.log(`  errorMetric: ${errorMetricName}`);
  console.log(`  latencyMetric: ${latencyMetricName}`);

  const errorMetric = metrics[errorMetricName];
  const latencyMetric = metrics[latencyMetricName];

  // http_req_failed is a rate metric: values.rate
  const errorRate =
    errorMetric && errorMetric.values && typeof errorMetric.values.rate === "number"
      ? errorMetric.values.rate
      : null;

  // http_req_duration has percentiles: values["p(95)"]
  const p95 =
    latencyMetric && latencyMetric.values
      ? (typeof latencyMetric.values["p(95)"] === "number"
          ? latencyMetric.values["p(95)"]
          : null)
      : null;

  console.log("[k6-summary] Parsed metrics:");
  console.log(`  errorRate: ${errorRate == null ? "UNKNOWN" : errorRate}`);
  console.log(`  p95(ms):   ${p95 == null ? "UNKNOWN" : p95}`);

  if (errorRate == null || p95 == null) {
    console.log(
      "[k6-summary] WARNING: k6 summary present but required metrics were not found."
    );
    console.log(
      `[k6-summary] Available metric names (first 40): ${firstN(metricNames, 40).join(", ")}`
    );
    console.log(
      "[k6-summary] Fix: ensure you generate this file via `k6 run --summary-export k6/smoke-summary.json ...`"
    );
    process.exit(2);
  }

  const errorOk = errorRate <= MAX_ERROR_RATE;
  const p95Ok = p95 <= MAX_P95_MS;

  if (!errorOk || !p95Ok) {
    console.log(
      `[k6-summary] FAIL – thresholds exceeded (max errorRate=${MAX_ERROR_RATE}, max p95=${MAX_P95_MS}ms)`
    );
    process.exit(1);
  }

  console.log("[k6-summary] OK – error rate and p95 within thresholds");
  process.exit(0);
}

main();
