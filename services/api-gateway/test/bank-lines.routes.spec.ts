import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import Fastify, { type FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";

import { createBankLinesPlugin } from "../src/routes/bank-lines";

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

type StoredBankLine = {
  id: string;
  orgId: string;
  idempotencyKey: string;
  amount: number;
  date: Date;
  payeeCiphertext: string;
  payeeKid: string;
  descCiphertext: string;
  descKid: string;
  createdAt: Date;
};

process.env.AUTH_DEV_SECRET ??= "local-dev-secret";
process.env.AUTH_ISSUER ??= "urn:test:issuer";
process.env.AUTH_AUDIENCE ??= "urn:test:aud";
process.env.AUTH_JWKS ??=
  JSON.stringify({
    keys: [
      {
        kid: "local-dev",
        kty: "oct",
        alg: "HS256",
        k: Buffer.from(process.env.AUTH_DEV_SECRET!, "utf8").toString("base64"),
      },
    ],
  });

const SECRET = process.env.AUTH_DEV_SECRET!;
const ISSUER = process.env.AUTH_ISSUER!;
const AUDIENCE = process.env.AUTH_AUDIENCE!;
const { authGuard } = await import("../src/auth.js");

function signToken({
  sub = "user-1",
  orgId = "org-1",
  role = "admin",
}: { sub?: string; orgId?: string; role?: string } = {}) {
  const payload: jwt.JwtPayload = {
    sub,
    orgId,
    role,
    mfaEnabled: true,
  };

  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: "5m",
    header: { kid: "local-dev" },
  });
}

describe("bank-lines routes", () => {
  let app: FastifyInstance;
  let bankLines: StoredBankLine[];

  beforeEach(async () => {
    bankLines = [];

    const prismaStub = {
      bankLine: {
        findUnique: async ({ where }: any) => {
          const { orgId, idempotencyKey } = where?.orgId_idempotencyKey ?? {};
          return (
            bankLines.find(
              (line) => line.orgId === orgId && line.idempotencyKey === idempotencyKey,
            ) ?? null
          );
        },
        create: async ({ data }: any) => {
          const amountInput = data.amount as any;
          const record: StoredBankLine = {
            id: data.id ?? `line-${bankLines.length + 1}`,
            orgId: data.orgId,
            idempotencyKey: data.idempotencyKey,
            amount:
              amountInput && typeof amountInput.toNumber === "function"
                ? amountInput.toNumber()
                : Number(amountInput),
            date: new Date(data.date),
            payeeCiphertext: data.payeeCiphertext,
            payeeKid: data.payeeKid,
            descCiphertext: data.descCiphertext,
            descKid: data.descKid,
            createdAt: data.createdAt ?? new Date(),
          };
          bankLines.push(record);
          return record;
        },
        findMany: async ({ where, orderBy }: any = {}) => {
          let results = [...bankLines];
          if (where?.orgId) {
            results = results.filter((line) => line.orgId === where.orgId);
          }
          if (orderBy?.createdAt === "desc") {
            results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return results;
        },
      },
    };

    app = Fastify();
    installErrorHandler(app);
    app.addHook("onRequest", authGuard);
    await app.register(createBankLinesPlugin({ prisma: prismaStub } as any));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects unauthenticated callers", async () => {
    const response = await app.inject({ method: "GET", url: "/bank-lines" });
    assert.equal(response.statusCode, 401);
  });

  it("rejects invalid payloads with structured validation errors", async () => {
    const token = signToken();
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: "oops" },
    });

    assert.equal(response.statusCode, 400);
    const body = response.json() as { error?: { code?: string; fields?: Array<{ path: string }> } };
    assert.equal(body.error?.code, "invalid_body");
    assert.ok(body.error?.fields?.some((field) => field.path === "idempotencyKey"));
  });

  it("creates bank lines for authorised roles", async () => {
    const token = signToken();
    const payload = {
      orgId: "org-1",
      idempotencyKey: "key-1",
      amount: 125.75,
      date: new Date().toISOString(),
      payeeCiphertext: "payee", 
      payeeKid: "payee-kid",
      descCiphertext: "desc",
      descKid: "desc-kid",
    };

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
    payload,
  });

    assert.equal(response.statusCode, 201);
    assert.equal(response.headers["idempotent-replay"], "false");

    const body = response.json() as { amount: number; orgId: string; payeeCiphertext?: string };
    assert.equal(body.orgId, "org-1");
    assert.equal(body.amount, 125.75);
    assert.ok(!Object.prototype.hasOwnProperty.call(body, "payeeCiphertext"));
  });

  it("replays the prior response when idempotency key is reused", async () => {
    const token = signToken();
    const payload = {
      orgId: "org-1",
      idempotencyKey: "replay-key",
      amount: 99.5,
      date: new Date().toISOString(),
      payeeCiphertext: "payee", 
      payeeKid: "payee-kid",
      descCiphertext: "desc",
      descKid: "desc-kid",
    };

    const first = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 201);
    assert.equal(second.headers["idempotent-replay"], "true");
    assert.deepEqual(second.json(), first.json());
  });

  it("rejects callers without sufficient role", async () => {
    const token = signToken({ role: "viewer" });
    const payload = {
      orgId: "org-1",
      idempotencyKey: "deny-role",
      amount: 10,
      date: new Date().toISOString(),
      payeeCiphertext: "payee",
      payeeKid: "payee-kid",
      descCiphertext: "desc",
      descKid: "desc-kid",
    };

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    assert.equal(response.statusCode, 403);
    const body = response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "forbidden_role");
  });

  it("enforces organisation scope on writes", async () => {
    const token = signToken({ orgId: "org-1" });
    const payload = {
      orgId: "different-org",
      idempotencyKey: "wrong-org",
      amount: 25,
      date: new Date().toISOString(),
      payeeCiphertext: "payee",
      payeeKid: "payee-kid",
      descCiphertext: "desc",
      descKid: "desc-kid",
    };

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    assert.equal(response.statusCode, 403);
    const body = response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "forbidden_wrong_org");
  });

  it("lists bank lines filtered to the caller's organisation", async () => {
    const token = signToken({ orgId: "org-1" });

    // seed one line for caller org and one for a different org
    bankLines.push({
      id: "line-1",
      orgId: "org-1",
      idempotencyKey: "list-1",
      amount: 12,
      date: new Date("2024-01-02"),
      payeeCiphertext: "payee",
      payeeKid: "payee-kid",
      descCiphertext: "desc",
      descKid: "desc-kid",
      createdAt: new Date("2024-01-03"),
    });
    bankLines.push({
      id: "line-2",
      orgId: "other-org",
      idempotencyKey: "list-2",
      amount: 99,
      date: new Date("2024-01-04"),
      payeeCiphertext: "other",
      payeeKid: "other-kid",
      descCiphertext: "other-desc",
      descKid: "other-desc-kid",
      createdAt: new Date("2024-01-05"),
    });

    const response = await app.inject({
      method: "GET",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { lines: Array<{ orgId: string; amount: number }> };
    assert.equal(body.lines.length, 1);
    assert.equal(body.lines[0]?.orgId, "org-1");
    assert.equal(body.lines[0]?.amount, 12);
  });
});
