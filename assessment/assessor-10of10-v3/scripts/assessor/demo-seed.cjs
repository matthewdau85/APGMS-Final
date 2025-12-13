"use strict";

/**
 * Demo seed script (template).
 *
 * Goal:
 * - Create deterministic fake org + stakeholders + transactions for demo.
 * - Print the created orgId and tokens so the operator can run a scripted walkthrough.
 *
 * This script is intentionally minimal. Wire it to your actual API when ready.
 *
 * Usage:
 *   node assessment/assessor-10of10-v3/scripts/assessor/demo-seed.cjs
 */

function main() {
  const demo = {
    orgId: "org-demo-1",
    adminUser: { id: "admin-1", role: "ADMIN" },
    businessUser: { id: "user-1", role: "ORG_OWNER", orgId: "org-demo-1" },
    regulatorUser: { id: "reg-1", role: "REGULATOR_READONLY" },
    notes: [
      "Replace this template by calling your /admin/orgs create endpoint and storing outputs.",
      "Keep the seed deterministic for repeatable demos."
    ]
  };

  // In a wired version, you would call the API gateway:
  // - POST /admin/orgs
  // - POST /admin/orgs/:id/config
  // - POST /org/:id/demo/seed
  // and then print tokens and IDs.

  console.log(JSON.stringify(demo, null, 2));
}

main();
