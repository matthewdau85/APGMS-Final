import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

import { includePrototypeEnv } from "../../services/api-gateway/src/lib/prototype-env";

beforeEach(() => {
  process.env.PROTOTYPE_ENV = "pilot";
});

test("admin responses include prototype flag", async () => {
  const app = Fastify();

  app.post("/session", async (request, reply) => {
    const role = (request.body as { role?: string }).role ?? "analyst";
    const payload = includePrototypeEnv(
      reply,
      {
        token: "demo-token",
        user: { id: "user-1", orgId: "org-1", role },
      },
      role,
    );
    reply.send(payload);
  });

  const response = await app.inject({
    method: "POST",
    url: "/session",
    payload: { role: "admin" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-prototype-env"], "pilot");
  const body = response.json() as { prototypeEnv?: string };
  assert.equal(body.prototypeEnv, "pilot");

  await app.close();
});

test("non-admin responses omit prototype flag", async () => {
  const app = Fastify();

  app.post("/session", async (request, reply) => {
    const role = (request.body as { role?: string }).role ?? "analyst";
    const payload = includePrototypeEnv(
      reply,
      {
        token: "demo-token",
        user: { id: "user-2", orgId: "org-1", role },
      },
      role,
    );
    reply.send(payload);
  });

  const response = await app.inject({
    method: "POST",
    url: "/session",
    payload: { role: "analyst" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-prototype-env"], undefined);
  const body = response.json() as { prototypeEnv?: string };
  assert.equal(body.prototypeEnv, undefined);

  await app.close();
});
