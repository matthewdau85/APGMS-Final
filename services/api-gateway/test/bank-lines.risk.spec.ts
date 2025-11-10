import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildServer } from "../src/app";
import { prisma } from "../src/db";
import type { FastifyInstance } from "fastify";
import type { RiskScoreResponse } from "../src/clients/ml-service";

type StubbedMlClient = {
  scoreShortfall: () => Promise<RiskScoreResponse>;
  scoreFraud: () => Promise<RiskScoreResponse>;
};

const baseRisk = {
  model: "shortfall",
  risk_level: "low" as const,
  mitigations: [],
  top_explanations: [],
};

describe("bank-line ML gating", () => {
  let app: FastifyInstance;
  let originalUpsert: typeof prisma.bankLine.upsert;
  let originalAggregate: typeof prisma.bankLine.aggregate;
  let originalMlClient: any;

  beforeEach(async () => {
    app = await buildServer();
    // inject a test user so route guards pass
    app.addHook("onRequest", (request, _reply, done) => {
      (request as any).user = { orgId: "org-123" };
      done();
    });

    originalUpsert = prisma.bankLine.upsert;
    prisma.bankLine.upsert = async () =>
      ({
        id: "bank-line-1",
        orgId: "org-123",
        date: new Date(),
        amount: 2500000,
        payeeCiphertext: "cipher",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "desc-kid",
        createdAt: new Date(),
        idempotencyKey: "idem",
      } as any);

    originalAggregate = prisma.bankLine.aggregate;
    prisma.bankLine.aggregate = async () => ({ _sum: { amount: 1_500_000 } } as any);

    originalMlClient = app.mlClient;
  });

  afterEach(async () => {
    prisma.bankLine.upsert = originalUpsert;
    prisma.bankLine.aggregate = originalAggregate;
    app.mlClient = originalMlClient;
    await app.close();
    await prisma.$disconnect();
  });

  it("blocks transfers when shortfall risk crosses threshold", async () => {
    const stubClient: StubbedMlClient = {
      scoreShortfall: async () => ({
        ...baseRisk,
        score: 0.82,
        threshold: 0.6,
        exceeds_threshold: true,
        model: "shortfall",
      }),
      scoreFraud: async () => ({
        ...baseRisk,
        model: "fraud",
        score: 0.1,
        threshold: 0.6,
        risk_level: "low",
        exceeds_threshold: false,
      }),
    };
    app.mlClient = stubClient as any;
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org-123",
        idempotencyKey: "abc",
        amount: 2_500_000,
        date: new Date().toISOString(),
        payeeCiphertext: "cipher",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "desc-kid",
      },
    });

    assert.equal(response.statusCode, 409);
    const body = response.json();
    assert.equal(body.error, "shortfall_risk");
    assert.ok(body.risk);
  });

  it("blocks transfers when fraud risk exceeds threshold", async () => {
    const stubClient: StubbedMlClient = {
      scoreShortfall: async () => ({
        ...baseRisk,
        score: 0.3,
        threshold: 0.6,
        exceeds_threshold: false,
      }),
      scoreFraud: async () => ({
        ...baseRisk,
        model: "fraud",
        score: 0.72,
        threshold: 0.58,
        exceeds_threshold: true,
        risk_level: "high",
      }),
    };
    app.mlClient = stubClient as any;
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org-123",
        idempotencyKey: "abc",
        amount: 900_000,
        date: new Date().toISOString(),
        payeeCiphertext: "cipher",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "desc-kid",
      },
    });

    assert.equal(response.statusCode, 409);
    const body = response.json();
    assert.equal(body.error, "fraud_risk");
  });

  it("creates bank line when both risk checks are within tolerance", async () => {
    const stubClient: StubbedMlClient = {
      scoreShortfall: async () => ({
        ...baseRisk,
        score: 0.21,
        threshold: 0.6,
        exceeds_threshold: false,
      }),
      scoreFraud: async () => ({
        ...baseRisk,
        model: "fraud",
        score: 0.22,
        threshold: 0.58,
        exceeds_threshold: false,
      }),
    };
    app.mlClient = stubClient as any;
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org-123",
        idempotencyKey: "abc",
        amount: 500_000,
        date: new Date().toISOString(),
        payeeCiphertext: "cipher",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "desc-kid",
      },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.risk.shortfall.score, 0.21);
    assert.equal(body.risk.fraud.score, 0.22);
  });
});
