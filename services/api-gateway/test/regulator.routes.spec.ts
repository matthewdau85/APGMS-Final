import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import { registerRegulatorRoutes } from "../src/routes/regulator";
import type { recordAuditLog } from "../src/lib/audit.js";

const now = new Date();
const fakeBankLine = {
  id: "line-1",
  orgId: "org-test",
  date: now,
  amount: 100,
  createdAt: now,
};

const stubPrisma = {
  basCycle: {
    findMany: async () => [],
    findFirst: async () => null,
  },
  paymentPlanRequest: {
    findMany: async () => [],
  },
  alert: {
    count: async () => 0,
    findMany: async () => [],
  },
  designatedAccount: {
    findMany: async () => [],
  },
  monitoringSnapshot: {
    findMany: async () => [],
  },
  evidenceArtifact: {
    findMany: async () => [],
    findUnique: async () => null,
  },
  bankLine: {
    aggregate: async () => ({
      _count: { id: 0 },
      _sum: { amount: 0 },
    }),
    findFirst: async () => fakeBankLine,
    findMany: async () => [fakeBankLine],
  },
};

const stubAuditLog: (entry: Parameters<typeof recordAuditLog>[0]) => Promise<void> = async () => {};

describe("regulator routes wiring", () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    app.addHook("onRequest", (request: FastifyRequest, _reply: FastifyReply, done) => {
      (request as FastifyRequest & { user?: { orgId?: string; sub?: string } }).user = {
        orgId: "org-test",
        sub: "regulator-user",
      };
      done();
    });
    await app.register(async (regScope) => {
      await registerRegulatorRoutes(regScope, {
        prisma: stubPrisma as any,
        auditLogger: stubAuditLog,
      });
    }, { prefix: "/regulator" });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("exposes health at /regulator/health", async () => {
    const response = await app.inject({ method: "GET", url: "/regulator/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true, service: "regulator" });
  });

  it("serves compliance and alerts endpoints", async () => {
    const report = await app.inject({
      method: "GET",
      url: "/regulator/compliance/report",
    });
    assert.equal(report.statusCode, 200);
    assert.equal(report.json().orgId, "org-test");

    const alerts = await app.inject({
      method: "GET",
      url: "/regulator/alerts",
    });
    assert.equal(alerts.statusCode, 200);
    assert.deepEqual(alerts.json(), { alerts: [] });
  });

  it("services bank-line summary and evidence routes", async () => {
    const summary = await app.inject({
      method: "GET",
      url: "/regulator/bank-lines/summary",
    });
    assert.equal(summary.statusCode, 200);
    const summaryBody = summary.json();
    assert.equal(summaryBody.summary.totalEntries, 0);
    assert.ok(Array.isArray(summaryBody.recent));

    const evidence = await app.inject({
      method: "GET",
      url: "/regulator/evidence",
    });
    assert.equal(evidence.statusCode, 200);
    assert.deepEqual(evidence.json(), { artifacts: [] });
  });
});
