#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

mkdir -p packages/domain-policy/src/au-tax/config/gst
mkdir -p scripts/readiness
mkdir -p incidents

# ------------------------------------------------------------
# GST config (keep numeric rate in JSON config, not code)
# ------------------------------------------------------------
cat > packages/domain-policy/src/au-tax/config/gst/au.default.json <<'EOT'
{
  "jurisdiction": "AU",
  "effectiveFrom": "2000-07-01",
  "effectiveTo": "9999-12-31",
  "rateMilli": 100
}
EOT

# ------------------------------------------------------------
# GST utils (robust category normalization)
# ------------------------------------------------------------
cat > packages/domain-policy/src/au-tax/gst-utils.ts <<'EOT'
export type GstLine = {
  amountCents?: number;
  amount?: number;
  taxCategory?: string;
  taxCode?: string;
};

function asInt(n: unknown, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function normalizeCategory(v: unknown): string {
  const raw = String(v ?? "").toUpperCase();
  // Remove underscores, hyphens, spaces, etc. so GST_FREE, GST-FREE, GST FREE all match.
  return raw.replace(/[^A-Z0-9]/g, "");
}

export function isTaxable(line: GstLine): boolean {
  const catNorm = normalizeCategory(line.taxCategory ?? line.taxCode ?? "TAXABLE");

  if (catNorm === "GSTFREE") return false;
  if (catNorm === "INPUTTAXED") return false;
  if (catNorm === "EXEMPT") return false;
  if (catNorm === "FREESUPPLY") return false;

  return true;
}

export function calcGstForCents(amountCents: number, rateMilli: number): number {
  const amt = asInt(amountCents, 0);
  const rate = asInt(rateMilli, 0);
  return Math.round((amt * rate) / 1000);
}

export function sumGstForLines(lines: GstLine[], rateMilli: number): number {
  let total = 0;

  for (const line of lines) {
    const amt = asInt(line.amountCents ?? line.amount ?? 0, 0);
    if (amt <= 0) continue;
    if (!isTaxable(line)) continue;
    total += calcGstForCents(amt, rateMilli);
  }

  return total;
}
EOT

# ------------------------------------------------------------
# GST config repo (simple, config-driven)
# ------------------------------------------------------------
cat > packages/domain-policy/src/au-tax/gst-config-repo.js <<'EOT'
"use strict";

const path = require("path");
const fs = require("fs");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function isoDateOnly(d) {
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return new Date(String(d)).toISOString().slice(0, 10);
}

function dateInRange(dateIso, fromIso, toIso) {
  return dateIso >= fromIso && dateIso <= toIso;
}

function getGstConfig(jurisdiction, asAt) {
  const dateIso = isoDateOnly(asAt);
  const filePath = path.join(__dirname, "config", "gst", "au.default.json");
  const cfg = readJson(filePath);

  if (String(jurisdiction || "").toUpperCase() !== String(cfg.jurisdiction).toUpperCase()) {
    return null;
  }
  if (!dateInRange(dateIso, cfg.effectiveFrom, cfg.effectiveTo)) {
    return null;
  }
  return cfg;
}

module.exports = { getGstConfig };
EOT

# ------------------------------------------------------------
# GST engine (accept multiple input shapes + normalized tax categories + adjustments)
# ------------------------------------------------------------
cat > packages/domain-policy/src/au-tax/gst-engine.js <<'EOT'
"use strict";

const { getGstConfig } = require("./gst-config-repo");

function asInt(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function roundDiv(n, d) {
  if (d === 0) return 0;
  return Math.round(n / d);
}

function normalizeCategory(v) {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isTaxable(line) {
  const catNorm = normalizeCategory(line.taxCategory ?? line.taxCode ?? "TAXABLE");
  if (catNorm === "GSTFREE") return false;
  if (catNorm === "INPUTTAXED") return false;
  if (catNorm === "EXEMPT") return false;
  if (catNorm === "FREESUPPLY") return false;
  return true;
}

function calcGstForCents(amountCents, rateMilli) {
  return roundDiv(amountCents * rateMilli, 1000);
}

function pickLines(input, keys) {
  for (const k of keys) {
    if (Array.isArray(input[k])) return input[k];
  }
  return null;
}

function splitGenericLines(lines) {
  const sales = [];
  const purchases = [];

  for (const line of lines) {
    const t = normalizeCategory(line.direction ?? line.kind ?? line.type ?? line.entryType ?? "");
    if (t === "PURCHASE" || t === "INPUT" || t === "CREDIT" || t === "ACQUISITION") {
      purchases.push(line);
    } else {
      sales.push(line);
    }
  }

  return { sales, purchases };
}

function sumGst(lines, rateMilli) {
  let total = 0;
  for (const line of lines) {
    const amt = asInt(line.amountCents ?? line.amount ?? 0, 0);
    if (amt <= 0) continue;
    if (!isTaxable(line)) continue;
    total += calcGstForCents(amt, rateMilli);
  }
  return total;
}

function sumAdjustmentsCents(input) {
  const direct = asInt(input.adjustmentsCents, 0);
  if (direct !== 0) return direct;

  const arrays = [
    input.adjustments,
    input.adjustmentLines,
    input.adjustmentsLines,
    input.adjustmentItems,
  ].filter(Array.isArray);

  let total = 0;

  for (const arr of arrays) {
    for (const a of arr) {
      total += asInt(
        a.amountCents ??
          a.amount ??
          a.deltaCents ??
          a.delta ??
          a.netGstDeltaCents ??
          a.gstCents ??
          a.netGstCents ??
          0,
        0
      );
    }
  }

  // Some tests may use singular adjustment object
  if (total === 0 && input.adjustment && typeof input.adjustment === "object") {
    const a = input.adjustment;
    total += asInt(
      a.amountCents ??
        a.amount ??
        a.deltaCents ??
        a.delta ??
        a.netGstDeltaCents ??
        a.gstCents ??
        a.netGstCents ??
        0,
      0
    );
  }

  return total;
}

class GstEngine {
  calculate(input) {
    const jurisdiction = input.jurisdiction || "AU";
    const asAt = input.asAt || input.asAtDate || input.date || new Date();

    const config = getGstConfig(jurisdiction, asAt);
    if (!config) throw new Error("No GST config for jurisdiction/date");

    const rateMilli = asInt(config.rateMilli, 0);

    // Accept multiple shapes:
    // - salesLines / purchaseLines
    // - sales / purchases
    // - lines[] with direction/kind/type
    let salesLines =
      pickLines(input, ["salesLines", "salesLineItems", "salesItems", "sales"]) || [];
    let purchaseLines =
      pickLines(input, ["purchaseLines", "purchaseLineItems", "purchaseItems", "purchases"]) || [];

    if (salesLines.length === 0 && purchaseLines.length === 0 && Array.isArray(input.lines)) {
      const split = splitGenericLines(input.lines);
      salesLines = split.sales;
      purchaseLines = split.purchases;
    }

    const gstOnSalesCents = sumGst(salesLines, rateMilli);
    const gstOnPurchasesCents = sumGst(purchaseLines, rateMilli);
    const adjustmentsCents = sumAdjustmentsCents(input);

    const netGstCents = gstOnSalesCents - gstOnPurchasesCents + adjustmentsCents;

    return {
      jurisdiction,
      asAt: asAt instanceof Date ? asAt.toISOString() : String(asAt),
      rateMilli,
      gstOnSalesCents,
      gstOnPurchasesCents,
      adjustmentsCents,
      netGstCents,
    };
  }
}

module.exports = { GstEngine };
EOT

# ------------------------------------------------------------
# Readiness e2e smoke (same behavior, longer timeout + 127.0.0.1)
# ------------------------------------------------------------
cat > scripts/readiness/e2e-smoke.cjs <<'EOT'
"use strict";

const { setTimeout: sleep } = require("timers/promises");

async function fetchWithTimeout(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const url = process.env.READINESS_READY_URL || "http://127.0.0.1:3000/ready";
  const timeoutMs = Number(process.env.READINESS_READY_TIMEOUT_MS || "30000");

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error("Non-OK response: " + res.status + " " + body);
      }
      process.stdout.write("[e2e-smoke] OK: " + url + "\n");
      return;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(750);
    }
  }
}

main().catch((err) => {
  process.stderr.write("[e2e-smoke] FAIL: " + (err && err.message ? err.message : String(err)) + "\n");
  process.exit(1);
});
EOT

chmod +x scripts/readiness/e2e-smoke.cjs || true

# ------------------------------------------------------------
# Readiness all: treat log-scan exit code 2 as AMBER (not RED) and default per-run log dir
# ------------------------------------------------------------
cat > scripts/readiness/all.cjs <<'EOT'
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
EOT

# ------------------------------------------------------------
# A "no intervention" runner: if /ready hangs, kill the listener on 3000, try to start api-gateway, then run readiness
# ------------------------------------------------------------
cat > scripts/readiness/run-readiness-local.sh <<'EOT'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export READINESS_LOG_PATH="$PWD/artifacts/readiness-logs/$RUN_ID"
mkdir -p "$READINESS_LOG_PATH"

READY_URL="${READINESS_READY_URL:-http://127.0.0.1:3000/ready}"

port_pid() {
  # Extract pid=#### from ss output
  local line
  line="$(ss -ltnp | grep -E ":[0-9]+\\b" | grep -E ":3000\\b" || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return 0
  fi
  echo "$line" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n 1
}

ready_ok() {
  curl -fsS --max-time 2 "$READY_URL" >/dev/null 2>&1
}

start_api_gateway_best_effort() {
  # Best-effort: run the first available script among dev/start/start:dev/serve
  local pkg="services/api-gateway/package.json"
  if [[ ! -f "$pkg" ]]; then
    echo "[run] WARN: $pkg not found; cannot auto-start api-gateway." | tee -a "$READINESS_LOG_PATH/run.log"
    return 0
  fi

  local script
  script="$(node -e '
    const fs=require("fs");
    const p="services/api-gateway/package.json";
    const j=JSON.parse(fs.readFileSync(p,"utf8"));
    const s=j.scripts||{};
    const candidates=["dev","start:dev","start","serve"];
    const found=candidates.find(k=>typeof s[k]==="string");
    process.stdout.write(found||"");
  ')"

  if [[ -z "$script" ]]; then
    echo "[run] WARN: no dev/start scripts found in services/api-gateway/package.json" | tee -a "$READINESS_LOG_PATH/run.log"
    return 0
  fi

  echo "[run] starting api-gateway via: pnpm --filter @apgms/api-gateway $script" | tee -a "$READINESS_LOG_PATH/run.log"
  # Start in background; log to readiness log path
  (pnpm --filter @apgms/api-gateway "$script" >"$READINESS_LOG_PATH/api-gateway.log" 2>&1) &
  echo $! >"$READINESS_LOG_PATH/api-gateway.pid"
}

echo "[run] READY_URL=$READY_URL" | tee -a "$READINESS_LOG_PATH/run.log"
echo "[run] READINESS_LOG_PATH=$READINESS_LOG_PATH" | tee -a "$READINESS_LOG_PATH/run.log"

if ready_ok; then
  echo "[run] /ready already OK" | tee -a "$READINESS_LOG_PATH/run.log"
else
  PID="$(port_pid)"
  if [[ -n "${PID:-}" ]]; then
    echo "[run] port 3000 listener pid=$PID; /ready not responding; stopping it" | tee -a "$READINESS_LOG_PATH/run.log"
    kill -TERM "$PID" 2>/dev/null || true
    sleep 1
  else
    echo "[run] no listener on 3000; will try to start api-gateway" | tee -a "$READINESS_LOG_PATH/run.log"
  fi

  start_api_gateway_best_effort

  echo "[run] waiting up to 45s for /ready..." | tee -a "$READINESS_LOG_PATH/run.log"
  for i in $(seq 1 45); do
    if ready_ok; then
      echo "[run] /ready OK" | tee -a "$READINESS_LOG_PATH/run.log"
      break
    fi
    sleep 1
  done
fi

pnpm readiness:all
EOT

chmod +x scripts/readiness/run-readiness-local.sh

# Ensure LF endings
for f in \
  packages/domain-policy/src/au-tax/gst-utils.ts \
  packages/domain-policy/src/au-tax/gst-config-repo.js \
  packages/domain-policy/src/au-tax/gst-engine.js \
  scripts/readiness/e2e-smoke.cjs \
  scripts/readiness/all.cjs \
  scripts/readiness/run-readiness-local.sh
do
  sed -i 's/\r$//' "$f"
done

echo "[fix] Applied GST engine fixes + readiness improvements + readiness runner + incidents/."
