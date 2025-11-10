import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app";
import { prisma } from "../src/db";

const originalFetch = global.fetch;
const originalQueryRaw = prisma.$queryRaw;
const originalBasFindFirst = prisma.basCycle.findFirst;
const originalBasCount = prisma.basCycle.count;
const originalAlertCount = prisma.alert.count;

function installPrismaStubs(): void {
  const now = Date.now();
  (prisma as any).$queryRaw = async () => 1;
  (prisma.basCycle as any).findFirst = async () => ({
    id: "cycle-1",
    orgId: "org-1",
    periodEnd: new Date(now + 5 * 86400000),
    paygwRequired: 200000,
    paygwSecured: 120000,
    gstRequired: 180000,
    gstSecured: 90000,
  });
  (prisma.basCycle as any).count = async () => 1;
  (prisma.alert as any).count = async () => 3;
}

function restorePrisma(): void {
  (prisma as any).$queryRaw = originalQueryRaw;
  prisma.basCycle.findFirst = originalBasFindFirst;
  prisma.basCycle.count = originalBasCount;
  prisma.alert.count = originalAlertCount;
}

process.env.ML_SERVICE_URL ??= "http://ml-service:8000";

type FetchFixtures = {
  shortfall?: Record<string, unknown>;
  fraud?: Record<string, unknown>;
};

function installFetchStub(fixtures: FetchFixtures): void {
  const ResponseCtor = globalThis.Response;
  global.fetch = (async (input: any) => {
    const target = typeof input === "string" ? input : input.url ?? String(input);
    const url = new URL(target);
    const path = url.pathname;
    if (path.endsWith("/risk/shortfall")) {
      const payload = fixtures.shortfall ?? {
        modelVersion: "test",
        riskScore: 0.2,
        riskLevel: "low",
        recommendedMitigations: [],
        explanation: "",
        contributingFactors: [],
      };
      return new ResponseCtor(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (path.endsWith("/risk/fraud")) {
      const payload = fixtures.fraud ?? {
        modelVersion: "test",
        riskScore: 0.2,
        riskLevel: "low",
        recommendedMitigations: [],
        explanation: "",
        contributingFactors: [],
      };
      return new ResponseCtor(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new ResponseCtor(JSON.stringify({ error: "not_found" }), { status: 404 });
  }) as typeof fetch;
}

beforeEach(() => {
  installPrismaStubs();
});

afterEach(() => {
  global.fetch = originalFetch;
  restorePrisma();
});

describe("ML risk flows", () => {
  it("blocks readiness when model reports high shortfall risk", async () => {
    installFetchStub({
      shortfall: {
        modelVersion: "test",
        riskScore: 0.91,
        riskLevel: "high",
        recommendedMitigations: ["Buffer cash"],
        explanation: "Coverage below threshold",
        contributingFactors: [],
      },
    });

    const app = await createApp();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/ready" });
    assert.equal(response.statusCode, 503);
    const body = response.json() as any;
    assert.equal(body.blocked, true);
    assert.equal(body.risk.riskLevel, "high");

    await app.close();
  });

  it("annotates ledger reconciliation results with model output", async () => {
    installFetchStub({
      shortfall: {
        modelVersion: "test",
        riskScore: 0.55,
        riskLevel: "medium",
        recommendedMitigations: ["Reconcile variance"],
        explanation: "Variance detected",
        contributingFactors: [],
      },
    });

    const app = await createApp();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/risk/ledger-reconciliation",
      payload: {
        orgId: "org-1",
        totalExposure: 500000,
        securedPercentage: 0.8,
        varianceAmount: 20000,
        unreconciledEntries: 3,
        basWindowDays: 4,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as any;
    assert.equal(body.blocked, false);
    assert.equal(body.risk.riskLevel, "medium");
    assert.equal(body.warning, "ledger_reconciliation_medium");

    await app.close();
  });

  it("gates fraud screening when the model response is high risk", async () => {
    installFetchStub({
      fraud: {
        modelVersion: "test",
        riskScore: 0.8,
        riskLevel: "high",
        recommendedMitigations: ["Hold payout"],
        explanation: "Velocity anomaly",
        contributingFactors: [],
      },
    });

    const app = await createApp();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/risk/fraud-screen",
      payload: {
        transactionId: "txn-1",
        amount: 125000,
        channelRisk: 0.9,
        velocity: 4,
        geoDistance: 1800,
        accountTenureDays: 45,
        previousIncidents: 1,
      },
    });

    assert.equal(response.statusCode, 409);
    const body = response.json() as any;
    assert.equal(body.blocked, true);
    assert.equal(body.risk.riskLevel, "high");

    await app.close();
  });
});
