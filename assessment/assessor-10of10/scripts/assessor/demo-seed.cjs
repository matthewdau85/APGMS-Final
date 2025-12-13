"use strict";

/*
  Deterministic demo fixtures generator

  Output:
    artifacts/demo/demo-fixtures.json

  This does NOT write to the database. It generates fixtures that your API/demo runner
  can ingest in SIMULATED mode.
*/

const fs = require("node:fs");
const path = require("node:path");

function safeMkdir(p) { fs.mkdirSync(p, { recursive: true }); }

function main() {
  const outDir = path.join(process.cwd(), "artifacts", "demo");
  safeMkdir(outDir);

  const fixtures = {
    meta: {
      generatedAt: new Date().toISOString(),
      mode: "SIMULATED",
      deterministicSeed: "apgms-demo-seed-v1"
    },
    org: {
      name: "Demo Org",
      abn: "00000000000"
    },
    stakeholders: [
      { type: "Bank", name: "Simulated Bank Connector", simulated: true },
      { type: "Payroll", name: "Simulated Payroll Provider", simulated: true },
      { type: "Regulator", name: "Simulated ATO Endpoint", simulated: true }
    ],
    events: [
      {
        id: "payroll-evt-001",
        kind: "PAYROLL_EVENT",
        period: "2025-Q1",
        grossWages: 100000,
        paygwWithheld: 25000,
        gstComponent: 0,
        timestampUtc: "2025-01-15T00:00:00Z"
      }
    ]
  };

  const outPath = path.join(outDir, "demo-fixtures.json");
  fs.writeFileSync(outPath, JSON.stringify(fixtures, null, 2) + "\n", "utf8");
  console.log("Wrote " + outPath.replace(/\\/g, "/"));
}

main();
