import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import { registerMlFeedbackRoutes } from "../src/routes/ml-feedback.js";
import type { Principal } from "../src/lib/auth.js";

type PrismaMock = {
  modelFeedback: {
    upsert: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
};

describe("ML feedback routes", () => {
  let app: ReturnType<typeof Fastify>;
  let authenticateImpl: (
    req: FastifyRequest,
    reply: FastifyReply,
    roles: readonly string[],
  ) => Promise<Principal | null>;
  const prisma: PrismaMock = {
    modelFeedback: {
      upsert: async () => { throw new Error("not stubbed"); },
      findMany: async () => [],
    },
  };

  beforeEach(async () => {
    app = Fastify({ logger: false });
    authenticateImpl = async () => ({
      id: "principal-1",
      orgId: "org-123",
      roles: ["admin"],
      token: "token",
    });

    await registerMlFeedbackRoutes(app, {
      prisma: prisma as any,
      authenticate: async (req, reply, roles) => authenticateImpl(req, reply, roles),
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    authenticateImpl = async (_req, reply) => {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    };

    const response = await app.inject({
      method: "POST",
      url: "/ml/feedback",
      payload: {
        orgId: "org-123",
        inferenceId: "inf-1",
        modelName: "risk-score",
        label: "false_positive",
      },
    });

    assert.equal(response.statusCode, 401);
  });

  it("rejects mismatched org assignments", async () => {
    let upsertCalled = false;
    prisma.modelFeedback.upsert = (async () => {
      upsertCalled = true;
      return null;
    }) as any;

    const response = await app.inject({
      method: "POST",
      url: "/ml/feedback",
      payload: {
        orgId: "other-org",
        inferenceId: "inf-1",
        modelName: "risk-score",
        label: "false_negative",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(upsertCalled, false);
  });

  it("stores operator feedback and returns canonical payload", async () => {
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const updatedAt = new Date("2025-01-01T01:00:00.000Z");

    prisma.modelFeedback.upsert = async (args) => {
      assert.equal(args.where.orgId_inferenceId.orgId, "org-123");
      assert.equal(args.where.orgId_inferenceId.inferenceId, "inf-1");
      assert.equal(args.create.label, "FALSE_POSITIVE");
      assert.equal(args.create.submittedById, "principal-1");
      return {
        id: "feedback-1",
        orgId: "org-123",
        inferenceId: "inf-1",
        modelName: "risk-score",
        modelVersion: "2025-10-15",
        predictedLabel: "approve",
        expectedLabel: "deny",
        label: "FALSE_POSITIVE",
        submittedById: "principal-1",
        notes: "incorrectly flagged",
        payload: { confidence: 0.1 },
        createdAt,
        updatedAt,
      };
    };

    const response = await app.inject({
      method: "POST",
      url: "/ml/feedback",
      payload: {
        orgId: "org-123",
        inferenceId: "inf-1",
        modelName: "risk-score",
        modelVersion: "2025-10-15",
        predictedLabel: "approve",
        expectedLabel: "deny",
        label: "false_positive",
        notes: "incorrectly flagged",
        payload: { confidence: 0.1 },
      },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json() as any;
    assert.deepEqual(body.feedback, {
      id: "feedback-1",
      orgId: "org-123",
      inferenceId: "inf-1",
      modelName: "risk-score",
      modelVersion: "2025-10-15",
      predictedLabel: "approve",
      expectedLabel: "deny",
      label: "false_positive",
      submittedById: "principal-1",
      notes: "incorrectly flagged",
      payload: { confidence: 0.1 },
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("paginates stored feedback", async () => {
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    prisma.modelFeedback.findMany = async (args) => {
      assert.equal(args.where.orgId, "org-123");
      assert.equal(args.take, 10);
      return [
        {
          id: "feedback-1",
          orgId: "org-123",
          inferenceId: "inf-1",
          modelName: "risk-score",
          modelVersion: null,
          predictedLabel: null,
          expectedLabel: null,
          label: "FALSE_NEGATIVE",
          submittedById: "principal-1",
          notes: null,
          payload: null,
          createdAt,
          updatedAt: createdAt,
        },
      ];
    };

    const response = await app.inject({
      method: "GET",
      url: "/ml/feedback?limit=10",
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as any;
    assert.equal(body.nextCursor, null);
    assert.deepEqual(body.feedback, [
      {
        id: "feedback-1",
        orgId: "org-123",
        inferenceId: "inf-1",
        modelName: "risk-score",
        modelVersion: null,
        predictedLabel: null,
        expectedLabel: null,
        label: "false_negative",
        submittedById: "principal-1",
        notes: null,
        payload: null,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      },
    ]);
  });
});
