#!/usr/bin/env node
import process from "node:process";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const ACCESS_CODE = process.env.REGULATOR_ACCESS_CODE ?? "regulator-dev-code";
const EXPECTED_ORG_ID = process.env.REGULATOR_ORG_ID?.trim();

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Request failed: ${options.method ?? "GET"} ${path} -> ${res.status} ${body}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

async function main() {
  console.log(`[info] Regulator smoke against ${API_BASE_URL}`);

  const login = await request("/regulator/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessCode: ACCESS_CODE,
    }),
  });

  const token = login.token;
  if (!token) {
    throw new Error("Login response missing token");
  }

  const orgId = login.orgId ?? "unknown-org";
  if (EXPECTED_ORG_ID && orgId !== EXPECTED_ORG_ID) {
    throw new Error(
      `Logged into unexpected organisation: expected ${EXPECTED_ORG_ID}, received ${orgId}`,
    );
  }
  console.log(`  [ok] authenticated as org ${orgId}`);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  await request("/regulator/health");
  console.log("  [ok] health endpoint reachable");

  const compliance = await request("/regulator/compliance/report", { headers: authHeaders });
  console.log(
    `  [ok] compliance report fetched (${compliance.basHistory?.length ?? 0} BAS periods, ` +
      `${compliance.alertsSummary?.openHighSeverity ?? 0} high alerts open)`
  );

  const evidence = await request("/regulator/evidence", { headers: authHeaders });
  console.log(`  [ok] evidence catalogue returned (${evidence.artifacts?.length ?? 0} artifacts)`);

  const snapshots = await request("/regulator/monitoring/snapshots?limit=1", {
    headers: authHeaders,
  });
  console.log(
    `  [ok] monitoring snapshot access ok (latest id: ${
      snapshots.snapshots?.[0]?.id ?? "none"
    })`
  );

  const bankSummary = await request("/regulator/bank-lines/summary", {
    headers: authHeaders,
  });
  console.log(
    `  [ok] bank summary totals AUD ${Number(bankSummary.summary?.totalAmount ?? 0).toFixed(2)}`
  );

  console.log("[done] Regulator smoke completed");
}

main().catch((error) => {
  console.error("[fail] Regulator smoke failed");
  console.error(error);
  process.exit(1);
});
