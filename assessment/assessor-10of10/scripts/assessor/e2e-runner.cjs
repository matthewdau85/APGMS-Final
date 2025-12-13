"use strict";

const fs = require("node:fs");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function httpCall(baseUrl, t) {
  const url = baseUrl.replace(/\/$/, "") + t.path;
  const res = await fetch(url, { method: t.method || "GET" });
  return { status: res.status };
}

async function run() {
  const p = process.argv[2] || "docs/assessor/contracts/e2e-contract.json";
  const cfg = loadJson(p);
  const baseUrl = process.env[cfg.meta.baseUrlEnv] || cfg.meta.defaultBaseUrl;

  const tests = [];

  for (const t of (cfg.contracts.smoke || [])) {
    const r = await httpCall(baseUrl, t);
    const ok = r.status === t.expectStatus;
    tests.push({ name: t.name, status: ok ? "PASS" : "FAIL", detail: `expected ${t.expectStatus} got ${r.status}`, id: "smoke" });
  }

  for (const t of (cfg.contracts.authBoundaries || [])) {
    const r = await httpCall(baseUrl, t);
    const ok = r.status === t.expectStatus;
    tests.push({ name: t.name, status: ok ? "PASS" : "FAIL", detail: `expected ${t.expectStatus} got ${r.status}`, id: "authBoundaries" });
  }

  const fail = tests.some(x => x.status === "FAIL");
  const out = { status: fail ? "FAIL" : "PASS", baseUrl, tests };

  console.log(JSON.stringify(out, null, 2));
  process.exit(fail ? 2 : 0);
}

run().catch(err => {
  console.error(String(err));
  process.exit(2);
});
