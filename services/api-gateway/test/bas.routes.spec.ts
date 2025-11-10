import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import Fastify from "fastify";
import { Prisma } from "@prisma/client";

import { signToken } from "../src/auth";
import { registerBasRoutes } from "../src/routes/bas";

const USER_ID = "user-1";
const ORG_ID = "org-1";
const AUTH_TOKEN = signToken({ id: USER_ID, orgId: ORG_ID, role: "admin", mfaEnabled: true });
const ANALYST_TOKEN = signToken({
  id: "user-analyst",
  orgId: ORG_ID,
  role: "analyst",
  mfaEnabled: true,
});

describe("BAS routes", () => {
  let app: ReturnType<typeof Fastify> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("blocks BAS preview for roles without finance permissions", async () => {
    const prismaStub = {
      basCycle: { findFirst: async () => null, update: async () => null },
    } as any;

    app = Fastify();
    await registerBasRoutes(app, {
      prisma: prismaStub,
      getDesignatedSummary: async () => ({
        generatedAt: new Date().toISOString(),
        totals: { paygw: 0, gst: 0 },
        movementsLast24h: [],
      }),
      recordAuditLog: async () => undefined,
      requireRecentVerification: () => true,
      verifyChallenge: async () => ({ success: true, expiresAt: new Date() }),
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/bas/preview",
      headers: { authorization: `Bearer ${ANALYST_TOKEN}` },
    });

    assert.equal(response.statusCode, 403);
    const body = response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "forbidden_role");
  });

  it("computes preview using designated account totals", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const cycle = {
      id: "cycle-1",
      orgId: ORG_ID,
      periodStart: new Date("2024-10-01T00:00:00Z"),
      periodEnd: new Date("2024-12-31T23:59:59Z"),
      paygwRequired: new Prisma.Decimal(10000),
      gstRequired: new Prisma.Decimal(5000),
      paygwSecured: new Prisma.Decimal(0),
      gstSecured: new Prisma.Decimal(0),
      overallStatus: "BLOCKED",
      lodgedAt: null,
    } as const;

    const prismaStub = {
      basCycle: {
        findFirst: async () => cycle,
        update: async () => cycle,
      },
    } as any;

    app = Fastify();
    await registerBasRoutes(app, {
      prisma: prismaStub,
      getDesignatedSummary: async () => ({
        generatedAt: now.toISOString(),
        totals: { paygw: 12000, gst: 6000 },
        movementsLast24h: [],
      }),
      recordAuditLog: async () => undefined,
      requireRecentVerification: () => true,
      verifyChallenge: async () => ({ success: true, expiresAt: now }),
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/bas/preview",
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as any;
    assert.equal(body.basCycleId, cycle.id);
    assert.equal(body.overallStatus, "READY");
    assert.equal(body.paygw.required, 10000);
    assert.equal(body.paygw.secured, 12000);
    assert.equal(body.paygw.status, "READY");
    assert.equal(body.gst.required, 5000);
    assert.equal(body.gst.secured, 6000);
    assert.equal(body.gst.status, "READY");
    assert.deepEqual(body.blockers, []);
  });

  it("requires step-up verification before lodgment", async () => {
    const cycle = {
      id: "cycle-2",
      orgId: ORG_ID,
      periodStart: new Date("2024-07-01T00:00:00Z"),
      periodEnd: new Date("2024-09-30T23:59:59Z"),
      paygwRequired: new Prisma.Decimal(8000),
      gstRequired: new Prisma.Decimal(4000),
      paygwSecured: new Prisma.Decimal(0),
      gstSecured: new Prisma.Decimal(0),
      overallStatus: "BLOCKED",
      lodgedAt: null,
    } as const;

    const prismaStub = {
      basCycle: {
        findFirst: async () => cycle,
        update: async () => cycle,
      },
    } as any;

    app = Fastify();
    await registerBasRoutes(app, {
      prisma: prismaStub,
      getDesignatedSummary: async () => ({
        generatedAt: new Date().toISOString(),
        totals: { paygw: 9000, gst: 5000 },
        movementsLast24h: [],
      }),
      recordAuditLog: async () => undefined,
      requireRecentVerification: () => false,
      verifyChallenge: async () => ({ success: false }),
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bas/lodge",
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      payload: {},
    });

    assert.equal(response.statusCode, 403);
    const body = response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "mfa_required");
  });

  it("blocks BAS lodgment for roles without finance permissions", async () => {
    const cycle = {
      id: "cycle-role-locked",
      orgId: ORG_ID,
      periodStart: new Date("2024-04-01T00:00:00Z"),
      periodEnd: new Date("2024-06-30T23:59:59Z"),
      paygwRequired: new Prisma.Decimal(1000),
      gstRequired: new Prisma.Decimal(1000),
      paygwSecured: new Prisma.Decimal(0),
      gstSecured: new Prisma.Decimal(0),
      overallStatus: "BLOCKED",
      lodgedAt: null,
    } as const;

    const prismaStub = {
      basCycle: {
        findFirst: async () => cycle,
        update: async () => {
          throw new Error("should not update when forbidden");
        },
      },
    } as any;

    app = Fastify();
    await registerBasRoutes(app, {
      prisma: prismaStub,
      getDesignatedSummary: async () => ({
        generatedAt: new Date().toISOString(),
        totals: { paygw: 1000, gst: 1000 },
        movementsLast24h: [],
      }),
      recordAuditLog: async () => undefined,
      requireRecentVerification: () => true,
      verifyChallenge: async () => ({ success: true, expiresAt: new Date() }),
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bas/lodge",
      headers: { authorization: `Bearer ${ANALYST_TOKEN}` },
      payload: { mfaCode: "999999" },
    });

    assert.equal(response.statusCode, 403);
    const body = response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "forbidden_role");
  });

  it("lodges BAS when obligations are funded and MFA succeeds", async () => {
    const cycle = {
      id: "cycle-3",
      orgId: ORG_ID,
      periodStart: new Date("2024-01-01T00:00:00Z"),
      periodEnd: new Date("2024-03-31T23:59:59Z"),
      paygwRequired: new Prisma.Decimal(7000),
      gstRequired: new Prisma.Decimal(3000),
      paygwSecured: new Prisma.Decimal(0),
      gstSecured: new Prisma.Decimal(0),
      overallStatus: "BLOCKED",
      lodgedAt: null,
    } as const;

    let updateCalledWith: any = null;
    let auditLogged: any = null;

    const prismaStub = {
      basCycle: {
        findFirst: async () => cycle,
        update: async (args: any) => {
          updateCalledWith = args;
          return {
            id: cycle.id,
            overallStatus: args.data.overallStatus,
            lodgedAt: args.data.lodgedAt,
          };
        },
      },
    } as any;

    app = Fastify();
    await registerBasRoutes(app, {
      prisma: prismaStub,
      getDesignatedSummary: async () => ({
        generatedAt: new Date().toISOString(),
        totals: { paygw: 7000, gst: 3000 },
        movementsLast24h: [],
      }),
      recordAuditLog: async (entry) => {
        auditLogged = entry;
      },
      requireRecentVerification: () => false,
      verifyChallenge: async (_userId, code) => ({
        success: code === "123456",
        expiresAt: new Date(),
      }),
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bas/lodge",
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      payload: { mfaCode: "123456" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { basCycle: { id: string; status: string; lodgedAt: string } };
    assert.equal(body.basCycle.id, cycle.id);
    assert.equal(body.basCycle.status, "LODGED");
    assert.ok(new Date(body.basCycle.lodgedAt) instanceof Date);

    assert.ok(updateCalledWith);
    assert.equal(updateCalledWith.where.id, cycle.id);
    assert.ok(updateCalledWith.data.paygwSecured instanceof Prisma.Decimal);
    assert.equal(updateCalledWith.data.paygwSecured.toNumber(), 7000);
    assert.ok(updateCalledWith.data.gstSecured instanceof Prisma.Decimal);
    assert.equal(updateCalledWith.data.gstSecured.toNumber(), 3000);

    assert.ok(auditLogged);
    assert.equal(auditLogged.orgId, ORG_ID);
    assert.equal(auditLogged.action, "bas.lodged");
    assert.equal(auditLogged.metadata?.basCycleId, cycle.id);
  });
});
