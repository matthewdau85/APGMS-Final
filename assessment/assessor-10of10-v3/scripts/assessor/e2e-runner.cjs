"use strict";

/**
 * E2E runner (template)
 *
 * Reads docs/assessor/contracts/e2e-contract.json and executes the contract steps.
 * This template does not know your exact endpoints. Wire each action to your API routes.
 *
 * Usage:
 *   node assessment/assessor-10of10-v3/scripts/assessor/e2e-runner.cjs --baseUrl http://localhost:3000
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = args.baseUrl || "http://localhost:3000";

  const contractPath = path.resolve(__dirname, "..", "..", "docs", "assessor", "contracts", "e2e-contract.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

  console.log(`[e2e] baseUrl=${baseUrl}`);
  console.log(`[e2e] loaded contract ${contractPath}`);

  const golden = contract.contracts && contract.contracts.goldenPath;
  if (!golden) {
    console.error("[e2e] missing contracts.goldenPath");
    process.exit(2);
  }

  // TODO: implement action handlers. Example:
  const handlers = {
    seedDemo: async () => ({ orgId: "org-demo-1", adminToken: "TODO" }),
    uploadPayroll: async () => ({ status: "accepted" }),
    getForecast: async () => ({ obligationTotal: 1234.56 }),
    createBasSettlement: async () => ({ status: "created" }),
    getRegulatorSummary: async () => ({ risk: "LOW" }),
    seedTwoTenants: async () => ({ tenantA: "org-a", tenantB: "org-b" }),
    crossTenantRead: async () => ({ httpStatus: 403 }),
    noLeakage: async () => ({ responseContainsOtherTenantData: false })
  };

  for (const step of golden.steps || []) {
    const fn = handlers[step.action];
    if (!fn) {
      console.warn(`[e2e] SKIP step=${step.id} action=${step.action} (no handler)`);
      continue;
    }
    const res = await fn(step);
    console.log(`[e2e] OK step=${step.id} action=${step.action} -> ${JSON.stringify(res)}`);
  }

  console.log("[e2e] done (template)");
}

main().catch((e) => {
  console.error("[e2e] error:", e && e.message ? e.message : e);
  process.exit(2);
});
