import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import Fastify from "fastify";
import jwt from "jsonwebtoken";

process.env.AUTH_AUDIENCE ??= 'urn:test:aud';
process.env.AUTH_ISSUER ??= 'urn:test:issuer';
process.env.AUTH_DEV_SECRET ??= 'local-dev-secret';

const { authGuard } = await import('../src/auth');
const { prisma } = await import('../src/db');
const { registerBankLinesRoutes } = await import('../src/routes/bank-lines');

const SECRET = process.env.AUTH_DEV_SECRET!;
const ISSUER = process.env.AUTH_ISSUER!;
const AUDIENCE = process.env.AUTH_AUDIENCE!;

function signToken(
  overrides: Partial<jwt.JwtPayload> = {},
  options: jwt.SignOptions = {},
) {
  const payload: jwt.JwtPayload = {
    sub: "user-123",
    orgId: "org-123",
    role: "admin",
    mfaEnabled: true,
    ...overrides,
  };

  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: "5m",
    ...options,
  });
}

describe("/bank-lines routes", () => {
  let app: ReturnType<typeof Fastify>;
  const bankLineDelegate = prisma.bankLine as {
    findMany: (args: unknown) => Promise<any[]>;
    upsert: (args: unknown) => Promise<any>;
  };
  const originalFindMany = bankLineDelegate.findMany;
  const originalUpsert = bankLineDelegate.upsert;
  let findManyCalls: unknown[];
  let upsertCalls: unknown[];

  beforeEach(async () => {
    findManyCalls = [];
    upsertCalls = [];

    bankLineDelegate.findMany = async (args: unknown) => {
      findManyCalls.push(args);
      return [
        {
          id: "line-1",
          orgId: "org-123",
          accountRef: "acct",
          amountCents: 5000,
          currency: "USD",
          createdAt: new Date("2024-01-01T00:00:00Z"),
        },
      ];
    };

    bankLineDelegate.upsert = async (args: unknown) => {
      upsertCalls.push(args);
      return {
        id: "line-1",
        orgId: "org-123",
        accountRef: "acct",
        amountCents: 5000,
        currency: "USD",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      };
    };

    app = Fastify({ logger: false });
    await app.register(async (secure) => {
      secure.addHook("onRequest", authGuard);
      await registerBankLinesRoutes(secure);
    });
    await app.ready();
  });

  afterEach(async () => {
    bankLineDelegate.findMany = originalFindMany;
    bankLineDelegate.upsert = originalUpsert;
    await app.close();
  });

  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org-123",
        idempotencyKey: "key-1",
        amount: 100,
        date: new Date().toISOString(),
        payeeCiphertext: "payee",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "kid",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(upsertCalls.length, 0);
  });

  it("rejects writes to a different org", async () => {
    const token = signToken();
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        orgId: "org-456",
        idempotencyKey: "key-1",
        amount: 100,
        date: new Date().toISOString(),
        payeeCiphertext: "payee",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "kid",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(upsertCalls.length, 0);
  });

  it("rejects callers without the proper role", async () => {
    const token = signToken({ role: "viewer" });
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        orgId: "org-123",
        idempotencyKey: "key-1",
        amount: 100,
        date: new Date().toISOString(),
        payeeCiphertext: "payee",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "kid",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(upsertCalls.length, 0);
  });

  it("allows authorized callers to create bank lines", async () => {
    const token = signToken({ role: "accountant" });
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        orgId: "org-123",
        idempotencyKey: "key-1",
        amount: 100,
        date: new Date("2024-02-01T00:00:00Z").toISOString(),
        payeeCiphertext: "payee",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "kid",
      },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json() as Record<string, unknown>;
    assert.equal(body.orgId, "org-123");
    assert.equal(upsertCalls.length, 1);
  });

  it("lists bank lines for the caller's org", async () => {
    const token = signToken({ role: "owner" });
    const response = await app.inject({
      method: "GET",
      url: "/bank-lines",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { lines: Array<Record<string, unknown>> };
    assert.equal(Array.isArray(body.lines), true);
    assert.equal(body.lines.length, 1);
    assert.equal(findManyCalls.length, 1);
  });
});
