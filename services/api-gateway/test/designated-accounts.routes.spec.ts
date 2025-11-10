import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import Fastify from "fastify";

import { signToken } from "../src/auth";
import { registerDesignatedAccountRoutes } from "../src/routes/designated-accounts";

const USER_ID = "user-99";
const ORG_ID = "org-88";
const AUTH_TOKEN = signToken({ id: USER_ID, orgId: ORG_ID, role: "admin", mfaEnabled: true });
const ANALYST_TOKEN = signToken({
  id: "user-analyst",
  orgId: ORG_ID,
  role: "analyst",
  mfaEnabled: true,
});

describe("Designated account routes", () => {
  let app: ReturnType<typeof Fastify> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("rejects credits from users without treasury roles", async () => {
    app = Fastify();
    await registerDesignatedAccountRoutes(app, {
      prisma: {} as any,
      applyTransfer: async () => {
        throw new Error("should not be called");
      },
      recordAuditLog: async () => undefined,
      requireRecentVerification: () => true,
      verifyChallenge: async () => ({ success: true, expiresAt: new Date() }),
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/org/designated-accounts/acct-unauthorized/credit",
      headers: { authorization: `Bearer ${ANALYST_TOKEN}` },
      payload: { amount: 250, source: "MANUAL_TOP_UP" },
    });

    assert.equal(response.statusCode, 403);
    const body = response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "forbidden_role");
  });

  it("requires MFA before crediting designated accounts", async () => {
    const applyCalls: any[] = [];

    app = Fastify();
    await registerDesignatedAccountRoutes(app, {
      prisma: {} as any,
      applyTransfer: async (...args) => {
        applyCalls.push(args);
        throw new Error("should not be called");
      },
      recordAuditLog: async () => undefined,
      requireRecentVerification: () => false,
      verifyChallenge: async () => ({ success: false }),
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/org/designated-accounts/acct-1/credit",
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      payload: { amount: 500, source: "MANUAL_TOP_UP" },
    });

    assert.equal(response.statusCode, 403);
    const body = response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "mfa_required");
    assert.equal(applyCalls.length, 0);
  });

  it("credits designated accounts when MFA succeeds", async () => {
    const applyCalls: any[] = [];
    let auditLogged: any = null;

    app = Fastify();
    await registerDesignatedAccountRoutes(app, {
      prisma: {} as any,
      applyTransfer: async (context, input) => {
        applyCalls.push({ context, input });
        return {
          accountId: input.accountId,
          newBalance: 1500,
          transferId: "xfer-1",
          source: "MANUAL_TOP_UP",
        };
      },
      recordAuditLog: async (entry) => {
        auditLogged = entry;
      },
      requireRecentVerification: () => false,
      verifyChallenge: async (_userId, code) => ({
        success: code === "654321",
        expiresAt: new Date(),
      }),
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/org/designated-accounts/acct-2/credit",
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      payload: { amount: 500, source: "MANUAL_TOP_UP", mfaCode: "654321" },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json() as { transfer: { id: string; accountId: string; newBalance: number } };
    assert.deepEqual(body.transfer, {
      id: "xfer-1",
      accountId: "acct-2",
      newBalance: 1500,
      source: "MANUAL_TOP_UP",
    });

    assert.equal(applyCalls.length, 1);
    const call = applyCalls[0];
    assert.equal(call.input.orgId, ORG_ID);
    assert.equal(call.input.actorId, USER_ID);
    assert.equal(call.input.amount, 500);
    assert.equal(call.input.source, "MANUAL_TOP_UP");
    assert.ok(auditLogged);
    assert.equal(auditLogged.orgId, ORG_ID);
    assert.equal(auditLogged.actorId, USER_ID);
  });
});
