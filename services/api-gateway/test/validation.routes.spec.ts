import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";

import * as shared from "@apgms/shared";
import { registerBasRoutes } from "../src/routes/bas";
import { createTransferRoutes } from "../src/routes/transfers";
import { registerPaymentPlanRoutes } from "../src/routes/payment-plans";
import { registerRegulatorRoutes } from "../src/routes/regulator";

function installErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    const err = error as any;
    if (err?.status) {
      reply.status(err.status).send({ error: { code: err.code, message: err.message, fields: err.fields } });
      return;
    }
    reply.status(500).send({ error: { code: "internal_error" } });
  });
}

describe("critical route validation", () => {
  let app: FastifyInstance;
  let currentUser: any;
  let regulatorSession: any;

  beforeEach(() => {
    app = Fastify();
    installErrorHandler(app);
    currentUser = null;
    regulatorSession = null;
    app.addHook("onRequest", (request, _reply, done) => {
      (request as any).user = currentUser;
      (request as any).regulatorSession = regulatorSession;
      done();
    });
  });

  afterEach(async () => {
    mock.restoreAll();
    await app.close();
  });

  describe("BAS lodgment", () => {
    beforeEach(async () => {
      mock.method(shared, "recordBasLodgment", async () => ({ id: "lodg", status: "in_progress" } as any));
      mock.method(shared, "verifyObligations", async () => ({
        balance: { toString: () => "0" },
        pending: { toString: () => "0" },
        shortfall: null,
      } as any));
      mock.method(shared, "createTransferInstruction", async () => {});
      mock.method(shared, "createPaymentPlanRequest", async () => {});
      mock.method(shared, "finalizeBasLodgment", async () => {});

      await app.register(registerBasRoutes);
      await app.ready();
    });

    it("returns 400 with validation detail for malformed body", async () => {
      currentUser = { orgId: "org-1", role: "owner" };
      const response = await app.inject({ method: "POST", url: "/bas/lodgment", payload: { initiatedBy: "" } });

      assert.equal(response.statusCode, 400);
      const body = response.json() as { error?: { code?: string; fields?: Array<{ path: string }> } };
      assert.equal(body.error?.code, "invalid_body");
      assert.ok(body.error?.fields?.some((field) => field.path === "initiatedBy"));
    });

    it("rejects callers without the finance role", async () => {
      currentUser = { orgId: "org-1", role: "viewer" };
      const response = await app.inject({ method: "POST", url: "/bas/lodgment", payload: {} });
      assert.equal(response.statusCode, 403);
    });
  });

  describe("transfers idempotency", () => {
    const entries: any[] = [];
    const prismaStub = {
      idempotencyEntry: {
        findUnique: async ({ where }: any) => entries.find((e) => e.orgId === where.orgId_key.orgId && e.key === where.orgId_key.key) ?? null,
        create: async ({ data }: any) => {
          const record = { id: `id-${entries.length + 1}`, ...data };
          entries.push(record);
          return record;
        },
        update: async ({ where, data }: any) => {
          const entry = entries.find((e) => e.orgId === where.orgId_key.orgId && e.key === where.orgId_key.key);
          Object.assign(entry, data);
          return entry;
        },
      },
    };

    beforeEach(async () => {
      entries.length = 0;
      await app.register(
        createTransferRoutes({
          prisma: prismaStub as any,
          markTransferStatus: async () => {},
          recordCriticalAuditLog: async () => {},
        }),
      );
      await app.ready();
    });

    it("enforces validation and idempotent replay", async () => {
      currentUser = { orgId: "org-1", role: "admin", sub: "user-1" };
      const bad = await app.inject({ method: "POST", url: "/bas/transfer", payload: { mfaCode: "0000" } });
      assert.equal(bad.statusCode, 400);

      const payload = { instructionId: "inst-1", mfaCode: "0000" };
      const headers = { "Idempotency-Key": "x-transfer" };
      const first = await app.inject({ method: "POST", url: "/bas/transfer", payload, headers });
      assert.equal(first.statusCode, 200);
      assert.equal(first.headers["idempotent-replay"], "false");

      const second = await app.inject({ method: "POST", url: "/bas/transfer", payload, headers });
      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["idempotent-replay"], "true");
      assert.deepEqual(second.json(), first.json());
    });

    it("rejects unauthenticated transfer attempts", async () => {
      currentUser = null;
      const response = await app.inject({ method: "POST", url: "/bas/transfer", payload: { instructionId: "inst", mfaCode: "0000" } });
      assert.equal(response.statusCode, 401);
    });
  });

  describe("payment plans", () => {
    beforeEach(async () => {
      mock.method(shared, "createPaymentPlanRequest", async () => ({ id: "plan-1" } as any));
      await app.register(registerPaymentPlanRoutes);
      await app.ready();
    });

    it("rejects missing auth", async () => {
      currentUser = null;
      const response = await app.inject({ method: "POST", url: "/payment-plans", payload: {} });
      assert.equal(response.statusCode, 401);
    });

    it("enforces role and body validation", async () => {
      currentUser = { orgId: "org-1", role: "viewer" };
      const forbidden = await app.inject({ method: "POST", url: "/payment-plans", payload: {} });
      assert.equal(forbidden.statusCode, 403);

      currentUser = { orgId: "org-1", role: "admin" };
      const invalid = await app.inject({ method: "POST", url: "/payment-plans", payload: { reason: "short" } });
      assert.equal(invalid.statusCode, 400);
      const body = invalid.json() as { error?: { code?: string } };
      assert.equal(body.error?.code, "invalid_body");
    });
  });

  describe("regulator surface", () => {
    beforeEach(async () => {
      await app.register(registerRegulatorRoutes, { prefix: "/regulator" });
      await app.ready();
    });

    it("requires regulator authentication", async () => {
      const response = await app.inject({ method: "GET", url: "/regulator/compliance/report" });
      assert.equal(response.statusCode, 401);
    });

    it("validates monitoring snapshot limits", async () => {
      regulatorSession = { orgId: "org-1", id: "sess-1" };
      const response = await app.inject({
        method: "GET",
        url: "/regulator/monitoring/snapshots?limit=0",
      });
      assert.equal(response.statusCode, 400);
      const body = response.json() as { error?: { code?: string } };
      assert.equal(body.error?.code, "invalid_body");
    });
  });
});
