#!/usr/bin/env node
/**
 * Readiness check: k6 smoke test summary
 *
 * - Reads a k6 summary JSON file (from --summary-export)
 * - Checks error rate and p95 latency thresholds
 *
 * Env:
 *   K6_SUMMARY_PATH    (default: ./k6/smoke-summary.json)
 *   K6_MAX_ERROR_RATE  (default: 0.01  i.e. 1%)
 *   K6_MAX_P95_MS      (default: 1000  i.e. 1s)
 *   K6_REQS_METRIC     (default: "http_reqs")
 *   K6_LATENCY_METRIC  (default: "http_req_duration")
 */

const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

function loadJson(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function getMetric(summary, name) {
  return summary.metrics && summary.metrics[name];
}

function getRate(metric) {
  if (!metric || typeof metric.rate !== "number") return null;
  return metric.rate;
}

function getP95(metric) {
  if (!metric || !metric.percentiles) return null;
  const raw = metric.percentiles["95"] ?? metric.percentiles["p(95)"];
  if (typeof raw !== "number") return null;
  return raw;
}

function main() {
  const summaryPath = process.env.K6_SUMMARY_PATH || "./k6/smoke-summary.json";
  const abs = path.resolve(summaryPath);

  const maxErrorRate = Number(process.env.K6_MAX_ERROR_RATE || "0.01");
  const maxP95 = Number(process.env.K6_MAX_P95_MS || "1000");
  const reqsMetricName = process.env.K6_REQS_METRIC || "http_reqs";
  const latencyMetricName = process.env.K6_LATENCY_METRIC || "http_req_duration";

  if (!fs.existsSync(abs)) {
    console.error("[k6-summary] Summary file missing:", abs);
    process.exit(1);
  }

  console.log("[k6-summary] Reading k6 summary from:", abs);

  let summary;
  try {
    summary = loadJson(abs);
  } catch (err) {
    console.error("[k6-summary] Failed to parse JSON:", err.message);
    process.exit(1);
  }

  const reqsMetric = getMetric(summary, reqsMetricName);
  const latencyMetric = getMetric(summary, latencyMetricName);

  const errorRate = getRate(reqsMetric);
  const p95 = getP95(latencyMetric);

  console.log("[k6-summary] Parsed metrics:");
  console.log("  errorRate:", errorRate);
  console.log("  p95(ms):  ", p95);

  let ok = true;

  if (errorRate == null) {
    console.warn("[k6-summary] WARNING – error rate metric missing; treating as failure.");
    ok = false;
  } else if (errorRate > maxErrorRate) {
    console.error(
      `[k6-summary] FAIL – errorRate ${errorRate} exceeds max ${maxErrorRate}`
    );
    ok = false;
  }

  if (p95 == null) {
    console.warn("[k6-summary] WARNING – p95 latency metric missing; treating as failure.");
    ok = false;
  } else if (p95 > maxP95) {
    console.error(
      `[k6-summary] FAIL – p95 ${p95}ms exceeds max ${maxP95}ms`
    );
    ok = false;
  }

  if (!ok) {
    process.exit(1);
  }

  console.log("[k6-summary] OK – error rate and p95 within thresholds");
  process.exit(0);
}

if (require.main === module) {
  main();
}
