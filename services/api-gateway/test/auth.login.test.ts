import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

const savedEnv = {
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_DEV_AUTH: process.env.ENABLE_DEV_AUTH,
};

function resetEnv() {
  if (savedEnv.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = savedEnv.NODE_ENV;
  }

  if (savedEnv.ENABLE_DEV_AUTH === undefined) {
    delete process.env.ENABLE_DEV_AUTH;
  } else {
    process.env.ENABLE_DEV_AUTH = savedEnv.ENABLE_DEV_AUTH;
  }
}

describe("/auth/login gating", () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    resetEnv();
  });

  it("returns 404 in production even with dev flag", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_AUTH = "true";

    app = buildServer();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dev@example.com" },
    });

    assert.equal(response.statusCode, 404);
  });

  it("returns 404 in dev mode when flag is missing", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ENABLE_DEV_AUTH;

    app = buildServer();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dev@example.com" },
    });

    assert.equal(response.statusCode, 404);
  });

  it("returns 200 in dev mode when flag enabled and defaults to user role", async () => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_DEV_AUTH = "true";

    app = buildServer();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dev@example.com" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { ok: boolean; user?: { role?: string } };
    assert.equal(body.ok, true);
    assert.equal(body.user?.role, "user");
  });
});
