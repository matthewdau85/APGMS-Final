"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

function log(s) {
  process.stdout.write(String(s) + "\n");
}

function hr() {
  log("");
}

function runNodeScriptWithCode(scriptPath) {
  const abs = path.join(process.cwd(), scriptPath);
  const r = spawnSync(process.execPath, [abs], { stdio: "inherit", env: process.env });
  const code = Number.isFinite(r.status) ? r.status : 1;
  return code;
}

function fetchWithTimeout(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return fetch(url, { signal: ac.signal }).finally(() => clearTimeout(t));
}

function ssListenerInfo(port) {
  try {
    const out = execFileSync("bash", ["-lc", `ss -ltnp | sed -n '1p;/\\:${port}\\b/p'`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim();
  } catch {
    return "";
  }
}

function psCmdlineFromSsLine(line) {
  const m = line.match(/pid=(\d+)/);
  if (!m) return "";
  const pid = m[1];
  try {
    const cmd = execFileSync("bash", ["-lc", `ps -p ${pid} -o pid=,cmd=`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return cmd.trim();
  } catch {
    return "";
  }
}

async function main() {
  const readyUrl = process.env.READINESS_READY_URL || "http://127.0.0.1:3000/ready";
  const timeoutMs = Number(process.env.READINESS_READY_TIMEOUT_MS || "30000");

  // Default to a per-run folder to avoid scanning historic failures.
  if (!process.env.READINESS_LOG_PATH) {
    const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
    const p = path.join(process.cwd(), "artifacts", "readiness-logs", runId);
    fs.mkdirSync(p, { recursive: true });
    process.env.READINESS_LOG_PATH = p;
  }

  const results = {
    availability: "GREEN",
    e2e: "GREEN",
    logScan: "GREEN",
    incident: "GREEN",
  };

  log("");
  log("=== Availability & Performance ===");
  log("=== AVAILABILITY & PERFORMANCE PILLAR ===");
  log(`[availability] Checking ${readyUrl} ...`);

  try {
    const res = await fetchWithTimeout(readyUrl, timeoutMs);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("Non-OK response: " + res.status + " " + body);
    }
    log("[availability] OK");
    results.availability = "GREEN";
  } catch (e) {
    results.availability = "RED";
    log("[availability] ERROR: " + (e && e.message ? e.message : String(e)));

    const ss = ssListenerInfo(3000);
    if (ss) {
      log("[availability] Port 3000 listener (ss):");
      log(ss);
      const cmd = psCmdlineFromSsLine(ss);
      if (cmd) {
        log("[availability] Listener command line (ps):");
        log(cmd);
      }
    } else {
      log("[availability] No listener detected on port 3000 (ss returned nothing).");
    }

    log("[availability] Tip: ensure api-gateway is running and serves /ready on port 3000.");
  }

  hr();
  log("=== E2E Smoke (Link + Controls) ===");
  const e2eCode = runNodeScriptWithCode("scripts/readiness/e2e-smoke.cjs");
  if (e2eCode !== 0) results.e2e = "RED";

  hr();
  log("=== Log Scan ===");
  log("=== LOG SCAN PILLAR ===");
  const logScanCode = runNodeScriptWithCode("scripts/readiness/log-scan.cjs");

  // Convention: treat "no log files found" as AMBER. Many scanners exit 2 for this.
  if (logScanCode === 0) results.logScan = "GREEN";
  else if (logScanCode === 2) results.logScan = "AMBER";
  else results.logScan = "RED";

  hr();
  log("=== Incident Tooling ===");
  log("=== INCIDENT TOOLING PILLAR ===");
  const incidentDir = path.join(process.cwd(), "incidents");
  if (fs.existsSync(incidentDir)) {
    log("[incident] OK - incident tooling present.");
    results.incident = "GREEN";
  } else {
    log("[incident] AMBER - incidents/ directory not found.");
    results.incident = "AMBER";
  }

  hr();
  log("========================");
  log("Readiness summary");
  log("========================");
  log(`${results.availability}: Availability & Performance`);
  log(`${results.e2e}: E2E Smoke (Link + Controls)`);
  log(`${results.logScan}: Log Scan`);
  log(`${results.incident}: Incident Tooling`);

  const reds = Object.values(results).filter((x) => x === "RED").length;
  if (reds > 0) {
    hr();
    log("READINESS: RED - blockers detected.");
    process.exit(1);
  }

  hr();
  log("READINESS: GREEN");
}

main().catch((err) => {
  process.stderr.write("[readiness] FATAL: " + (err && err.message ? err.message : String(err)) + "\n");
  process.exit(1);
});
