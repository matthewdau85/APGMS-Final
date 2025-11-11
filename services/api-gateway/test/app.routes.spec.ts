import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";

import { buildServer } from "../src/app";
import { createBankLinesPlugin } from "../src/routes/bank-lines";

process.env.AUTH_DEV_SECRET ??= "local-dev-secret";
process.env.AUTH_ISSUER ??= "urn:test:issuer";
process.env.AUTH_AUDIENCE ??= "urn:test:aud";

const SECRET = process.env.AUTH_DEV_SECRET!;
process.env.AUTH_JWKS = JSON.stringify({
  keys: [
    {
      kid: "local-dev",
      kty: "oct",
      alg: "HS256",
      k: Buffer.from(SECRET, "utf8").toString("base64"),
    },
  ],
});

const ISSUER = process.env.AUTH_ISSUER!;
const AUDIENCE = process.env.AUTH_AUDIENCE!;

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

function signToken({
  sub = "user-1",
  orgId = "org-test",
  role = "admin",
}: { sub?: string; orgId?: string; role?: string } = {}) {
  return jwt.sign(
    {
      sub,
      orgId,
      role,
      mfaEnabled: true,
    },
    SECRET,
    {
      algorithm: "HS256",
      audience: AUDIENCE,
      issuer: ISSUER,
      expiresIn: "5m",
      header: { kid: "local-dev" },
    },
  );
}

function buildBankLinePlugin(records: StoredBankLine[]) {
  const prismaStub = {
    bankLine: {
      findUnique: async ({ where }: any) => {
        const org = where?.orgId_idempotencyKey?.orgId as string | undefined;
        const key = where?.orgId_idempotencyKey?.idempotencyKey as string | undefined;
        if (!org || !key) return null;
        return (
          records.find(
            (line) => line.orgId === org && line.idempotencyKey === key,
          ) ?? null
        );
      },
      create: async ({ data }: any) => {
        const amountValue = data.amount as unknown;
        const amount =
          amountValue && typeof amountValue === "object" &&
          typeof (amountValue as Prisma.Decimal).toNumber === "function"
            ? (amountValue as Prisma.Decimal).toNumber()
            : Number(amountValue);
        const entry: StoredBankLine = {
          id: data.id ?? `line-${records.length + 1}`,
          orgId: data.orgId,
          idempotencyKey: data.idempotencyKey,
          amount,
          date: new Date(data.date),
          payeeCiphertext: data.payeeCiphertext,
          payeeKid: data.payeeKid,
          descCiphertext: data.descCiphertext,
          descKid: data.descKid,
          createdAt: data.createdAt ?? new Date(),
        };
        records.push(entry);
        return entry;
      },
      findMany: async ({ where }: any = {}) => {
        const orgId = where?.orgId as string | undefined;
        return orgId ? records.filter((line) => line.orgId === orgId) : [...records];
      },
    },
  };

  return createBankLinesPlugin({ prisma: prismaStub as any });
}

const fetchCalls: string[] = [];
const originalFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = (async (url: any) => {
    fetchCalls.push(String(url));
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
});

after(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

describe("buildServer domain wiring", () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  beforeEach(() => {
    fetchCalls.length = 0;
  });

  it("rejects unauthenticated calls to /bank-lines", async () => {
    const plugin = buildBankLinePlugin([]);
    app = await buildServer({ bankLinesPlugin: plugin });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/bank-lines" });
    assert.equal(response.statusCode, 401);
  });

  it("serves bank lines for authenticated callers", async () => {
    const store: StoredBankLine[] = [
      {
        id: "line-1",
        orgId: "org-test",
        idempotencyKey: "alpha",
        amount: 42,
        date: new Date("2024-01-01"),
        payeeCiphertext: "payee",
        payeeKid: "kid",
        descCiphertext: "desc",
        descKid: "desc-kid",
        createdAt: new Date("2024-01-02"),
      },
      {
        id: "line-2",
        orgId: "other-org",
        idempotencyKey: "beta",
        amount: 99,
        date: new Date("2024-02-01"),
        payeeCiphertext: "other",
        payeeKid: "other-kid",
        descCiphertext: "other-desc",
        descKid: "other-desc-kid",
        createdAt: new Date("2024-02-02"),
      },
    ];
    const plugin = buildBankLinePlugin(store);
    app = await buildServer({ bankLinesPlugin: plugin });
    await app.ready();

    const token = signToken({ orgId: "org-test" });
    const response = await app.inject({
      method: "GET",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { lines: Array<{ orgId: string }> };
    assert.equal(body.lines.length, 1);
    assert.equal(body.lines[0]?.orgId, "org-test");
  });

  it("requires auth on /admin/data", async () => {
    const plugin = buildBankLinePlugin([]);
    app = await buildServer({ bankLinesPlugin: plugin });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/admin/data" });
    assert.equal(response.statusCode, 401);
  });

  it("returns admin data payloads for authenticated requests", async () => {
    const plugin = buildBankLinePlugin([]);
    app = await buildServer({ bankLinesPlugin: plugin });
    await app.ready();

    const token = signToken({ orgId: "org-test" });
    const response = await app.inject({
      method: "GET",
      url: "/admin/data",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { items: unknown[] };
    assert.ok(Array.isArray(body.items));
  });

  it("wires /tax/health behind auth", async () => {
    const plugin = buildBankLinePlugin([]);
    app = await buildServer({ bankLinesPlugin: plugin });
    await app.ready();

    const token = signToken({ orgId: "org-test" });
    const forbidden = await app.inject({ method: "GET", url: "/tax/health" });
    assert.equal(forbidden.statusCode, 401);

    const allowed = await app.inject({
      method: "GET",
      url: "/tax/health",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(allowed.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
  });
});

