import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import Fastify from "fastify";

import adminDataRoutes, {
  type AdminDataPluginOptions,
} from "../src/routes/admin.data";
import { adminDataDeleteResponseSchema } from "../src/schemas/admin.data";

const ADMIN_TOKEN = "admin-token";
const validHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` } as const;

const buildApp = async (
  options: Partial<AdminDataPluginOptions> = {}
): Promise<ReturnType<typeof Fastify>> => {
  const app = Fastify({ logger: false });
  await app.register(adminDataRoutes, {
    adminToken: ADMIN_TOKEN,
    deleteHandler: async (subjectId) => ({
      deletedAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
    }),
    ...options,
  });
  await app.ready();
  return app;
};

describe("POST /admin/data/delete", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 without bearer token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: { subjectId: "subject-1" },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "unauthorized" });
  });

  it("returns 401 with invalid bearer token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: { subjectId: "subject-1" },
      headers: { authorization: "Bearer nope" },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "unauthorized" });
  });

  it("returns 400 for invalid request body", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: {},
      headers: validHeaders,
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "invalid_request" });
  });

  it("returns 404 when delete handler cannot tombstone subject", async () => {
    await app.close();
    app = await buildApp({
      deleteHandler: async () => null,
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: { subjectId: "missing" },
      headers: validHeaders,
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: "not_found" });
  });

  it("returns 202 after creating a tombstone", async () => {
    await app.close();
    const calls: string[] = [];
    const deletedAt = "2024-02-03T04:05:06.000Z";
    app = await buildApp({
      deleteHandler: async (subjectId) => {
        calls.push(subjectId);
        return { deletedAt };
      },
    });

    const payload = { subjectId: "subject-9" } as const;

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload,
      headers: validHeaders,
    });

    assert.equal(response.statusCode, 202);
    const json = response.json();
    const parsed = adminDataDeleteResponseSchema.parse(json);
    assert.equal(parsed.status, "deleted");
    assert.equal(parsed.subjectId, payload.subjectId);
    assert.equal(parsed.deletedAt, deletedAt);
    assert.deepEqual(calls, [payload.subjectId]);
  });
});
