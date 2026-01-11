import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import Fastify from "fastify";
import jwt from "jsonwebtoken";

import { registerAuth } from "../src/plugins/auth.js";
import { registerBankLinesRoutes } from "../src/routes/bank-lines.js";

const savedEnv = {
  AUTH_DEV_SECRET: process.env.AUTH_DEV_SECRET,
  AUTH_AUDIENCE: process.env.AUTH_AUDIENCE,
  AUTH_ISSUER: process.env.AUTH_ISSUER,
};

function resetEnv() {
  if (savedEnv.AUTH_DEV_SECRET === undefined) {
    delete process.env.AUTH_DEV_SECRET;
  } else {
    process.env.AUTH_DEV_SECRET = savedEnv.AUTH_DEV_SECRET;
  }

  if (savedEnv.AUTH_AUDIENCE === undefined) {
    delete process.env.AUTH_AUDIENCE;
  } else {
    process.env.AUTH_AUDIENCE = savedEnv.AUTH_AUDIENCE;
  }

  if (savedEnv.AUTH_ISSUER === undefined) {
    delete process.env.AUTH_ISSUER;
  } else {
    process.env.AUTH_ISSUER = savedEnv.AUTH_ISSUER;
  }
}

function signToken(secret: string, orgId = "org-1") {
  return jwt.sign(
    { orgId, role: "user", sub: "user-1" },
    secret,
    {
      algorithm: "HS256",
      audience: process.env.AUTH_AUDIENCE,
      issuer: process.env.AUTH_ISSUER,
      expiresIn: "5m",
    }
  );
}

function createIdempotencyStore() {
  const entries: any[] = [];
  return {
    idempotencyEntry: {
      findUnique: async ({ where }: any) => {
        const key = where?.orgId_key?.key;
        const orgId = where?.orgId_key?.orgId;
        return entries.find((e) => e.key === key && e.orgId === orgId) ?? null;
      },
      create: async ({ data }: any) => {
        entries.push({ ...data });
        return data;
      },
      update: async ({ where, data }: any) => {
        const key = where?.orgId_key?.key;
        const orgId = where?.orgId_key?.orgId;
        const entry = entries.find((e) => e.key === key && e.orgId === orgId);
        if (entry) {
          Object.assign(entry, data);
        }
        return entry;
      },
    },
    _entries: entries,
  };
}

describe("/bank-lines idempotency", () => {
  let app: ReturnType<typeof Fastify> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    resetEnv();
  });

  it("replays original response for duplicate payload", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";

    const prisma = createIdempotencyStore();
    app = Fastify();
    await registerAuth(app);
    registerBankLinesRoutes(app, { prisma });
    await app.ready();

    const token = signToken(process.env.AUTH_DEV_SECRET);
    const payload = { idempotencyKey: "alpha", amountCents: 125 };

    const first = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload,
      headers: {
        authorization: `Bearer ${token}`,
        "Idempotency-Key": "alpha",
      },
    });
    assert.equal(first.statusCode, 201);
    assert.equal(first.headers["idempotent-replay"], "false");

    const second = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload,
      headers: {
        authorization: `Bearer ${token}`,
        "Idempotency-Key": "alpha",
      },
    });
    assert.equal(second.statusCode, 201);
    assert.equal(second.headers["idempotent-replay"], "true");
    assert.deepEqual(second.json(), first.json());
  });

  it("returns 409 when payload differs for same key", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";

    const prisma = createIdempotencyStore();
    app = Fastify();
    await registerAuth(app);
    registerBankLinesRoutes(app, { prisma });
    await app.ready();

    const token = signToken(process.env.AUTH_DEV_SECRET);

    const first = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: { idempotencyKey: "alpha", amountCents: 125 },
      headers: {
        authorization: `Bearer ${token}`,
        "Idempotency-Key": "alpha",
      },
    });
    assert.equal(first.statusCode, 201);

    const second = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: { idempotencyKey: "alpha", amountCents: 126 },
      headers: {
        authorization: `Bearer ${token}`,
        "Idempotency-Key": "alpha",
      },
    });
    assert.equal(second.statusCode, 409);
  });
});
