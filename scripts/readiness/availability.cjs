#!/usr/bin/env node
/**
 * Readiness check: Availability
 *
 * - Hits BASE_URL/ready (or /health/ready if you change READINESS_PATH)
 * - Exits 0 on HTTP 200
 * - Exits non-zero otherwise
 *
 * Env:
 *   READINESS_BASE_URL  (default: http://localhost:3000)
 *   READINESS_PATH      (default: /ready)
 */

const process = require("node:process");
const { spawn } = require("node:child_process");
const { URL } = require("node:url");
const https = require("node:https");
const http = require("node:http");

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("Request timed out"));
    });
  });
}

function isConnRefused(err) {
  return Boolean(
    err &&
      (err.code === "ECONNREFUSED" ||
        String(err.message || "").includes("ECONNREFUSED"))
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady(url, attempts, delayMs) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await get(url);
      if (res.statusCode === 200) return res;
    } catch {
      // ignore until attempts exhausted
    }
    await sleep(delayMs);
  }
  return null;
}

function startApiGateway(port) {
  const child = spawn("pnpm", ["--filter", "@apgms/api-gateway", "dev"], {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, PORT: String(port) },
    cwd: process.cwd(),
  });
  return child;
}

async function main() {
  const base = process.env.READINESS_BASE_URL || "http://localhost:3000";
  const path = process.env.READINESS_PATH || "/ready";
  const autostart =
    String(process.env.READINESS_AUTOSTART ?? "true").toLowerCase() === "true";

  let url;
  try {
    const u = new URL(base);
    const pathPart = path.startsWith("/") ? path : `/${path}`;
    // ensure exactly one slash between base path and readiness path
    const basePath = (u.pathname || "").replace(/\/+$/, "");
    u.pathname = basePath + pathPart;
    url = u.toString();
  } catch (err) {
    console.error("[availability] Invalid READINESS_BASE_URL:", err.message);
    process.exit(2);
  }

  console.log(`[availability] Checking ${url} ...`);

  let apiProcess = null;

  try {
    const res = await get(url);
    if (res.statusCode === 200) {
      console.log("[availability] OK - status 200 from readiness endpoint");
      try {
        const parsed = JSON.parse(res.body);
        console.log("[availability] Body:", parsed);
      } catch {
        console.log("[availability] Body is not JSON, but status is 200 - treating as OK");
      }
      process.exit(0);
    } else {
      console.error(
        `[availability] FAIL - expected 200, got ${res.statusCode}. Body snippet:`,
        res.body.slice(0, 200)
      );
      process.exit(1);
    }
  } catch (err) {
    if (autostart && isConnRefused(err)) {
      const port = new URL(base).port || "3000";
      console.log(`[availability] Starting API gateway on port ${port} ...`);
      apiProcess = startApiGateway(port);
      const res = await waitForReady(url, 40, 500);
      if (res && res.statusCode === 200) {
        console.log("[availability] OK - status 200 from readiness endpoint");
        try {
          const parsed = JSON.parse(res.body);
          console.log("[availability] Body:", parsed);
        } catch {
          console.log("[availability] Body is not JSON, but status is 200 - treating as OK");
        }
        if (apiProcess) apiProcess.kill("SIGTERM");
        process.exit(0);
      }
      if (apiProcess) apiProcess.kill("SIGTERM");
    }

    console.error("[availability] ERROR hitting readiness endpoint:", err.message);
    process.exit(1);
  }
}

main();
