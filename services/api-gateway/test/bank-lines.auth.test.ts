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

function signToken({
  orgId,
  role = "user",
  secret,
}: {
  orgId: string;
  role?: string;
  secret: string;
}) {
  return jwt.sign(
    { orgId, role },
    secret,
    {
      algorithm: "HS256",
      audience: process.env.AUTH_AUDIENCE,
      issuer: process.env.AUTH_ISSUER,
      expiresIn: "5m",
    }
  );
}

describe("/bank-lines auth", () => {
  let app: ReturnType<typeof Fastify> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    resetEnv();
  });

  it("returns 401 when auth is missing", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";

    app = Fastify();
    await registerAuth(app);
    registerBankLinesRoutes(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: { idempotencyKey: "alpha", amountCents: 100 },
    });

    assert.equal(response.statusCode, 401);
  });

  it("returns 401 when token is invalid", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";

    app = Fastify();
    await registerAuth(app);
    registerBankLinesRoutes(app);
    await app.ready();

    const badToken = signToken({
      orgId: "org-1",
      secret: "wrong-secret",
    });

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: { idempotencyKey: "alpha", amountCents: 100 },
      headers: { authorization: `Bearer ${badToken}` },
    });

    assert.equal(response.statusCode, 401);
  });

  it("returns 403 when orgId does not match token", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";

    app = Fastify();
    await registerAuth(app);
    registerBankLinesRoutes(app);
    await app.ready();

    const token = signToken({
      orgId: "org-a",
      secret: process.env.AUTH_DEV_SECRET,
    });

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: { idempotencyKey: "alpha", amountCents: 100, orgId: "org-b" },
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 403);
  });

  it("returns 201 when orgId matches token", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";
    process.env.AUTH_AUDIENCE = "urn:test:aud";
    process.env.AUTH_ISSUER = "urn:test:issuer";

    app = Fastify();
    await registerAuth(app);
    registerBankLinesRoutes(app);
    await app.ready();

    const token = signToken({
      orgId: "org-a",
      secret: process.env.AUTH_DEV_SECRET,
    });

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: { idempotencyKey: "alpha", amountCents: 100, orgId: "org-a" },
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 201);
  });
});
