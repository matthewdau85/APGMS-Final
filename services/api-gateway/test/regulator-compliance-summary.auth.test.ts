import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import jwt from "jsonwebtoken";

import { buildFastifyApp } from "../src/app.js";
import { registerAuth } from "../src/plugins/auth.js";

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
  role,
  secret,
}: {
  orgId: string;
  role: string;
  secret: string;
}) {
  return jwt.sign(
    { orgId, role, sub: "reg-test" },
    secret,
    { algorithm: "HS256", expiresIn: "5m" },
  );
}

describe("/regulator/compliance/summary auth", () => {
  let app: Awaited<ReturnType<typeof buildFastifyApp>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    resetEnv();
  });

  it("returns 401 when auth is missing", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";

    app = buildFastifyApp({ inMemoryDb: true });
    await registerAuth(app);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
    });

    assert.equal(response.statusCode, 401);
  });

  it("returns 403 for non-regulator tokens", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";

    app = buildFastifyApp({ inMemoryDb: true });
    await registerAuth(app);
    await app.ready();

    const token = signToken({
      orgId: "org-1",
      role: "user",
      secret: process.env.AUTH_DEV_SECRET,
    });

    const response = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 403);
  });

  it("returns 200 for regulator tokens", async () => {
    process.env.AUTH_DEV_SECRET = "test-secret";

    app = buildFastifyApp({ inMemoryDb: true });
    await registerAuth(app);
    await app.ready();

    const token = signToken({
      orgId: "org-1",
      role: "regulator",
      secret: process.env.AUTH_DEV_SECRET,
    });

    const response = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
  });
});
