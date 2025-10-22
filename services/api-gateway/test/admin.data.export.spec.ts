import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import Fastify from "fastify";

import adminDataRoutes, {
  type AdminDataPluginOptions,
} from "../src/routes/admin.data";
import {
  adminDataExportRequestSchema,
  adminDataExportResponseSchema,
} from "../src/schemas/admin.data";

const ADMIN_TOKEN = "super-secret-admin";

const validHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` } as const;

const buildApp = async (
  options: Partial<AdminDataPluginOptions> = {}
): Promise<ReturnType<typeof Fastify>> => {
  const app = Fastify({ logger: false });
  await app.register(adminDataRoutes, { adminToken: ADMIN_TOKEN, ...options });
  await app.ready();
  return app;
};

let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
});

test("401 when authorization header is missing", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { subjectId: "subject-1" },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("401 when authorization header is incorrect", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { subjectId: "subject-1" },
    headers: { authorization: "Bearer wrong-token" },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("400 for invalid request payload", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { subjectId: "" },
    headers: validHeaders,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: "invalid_request" });
});

test("404 when export handler cannot find subject", async () => {
  await app.close();
  app = await buildApp({
    exportHandler: async () => null,
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { subjectId: "missing-subject" },
    headers: validHeaders,
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: "not_found" });
});

test("200 returns validated export bundle", async () => {
  await app.close();
  const exportedAt = "2024-01-02T12:34:56.000Z";
  const calls: string[] = [];
  app = await buildApp({
    exportHandler: async (subjectId) => {
      calls.push(subjectId);
      return {
        version: "2024-01-01",
        subjectId,
        exportedAt,
        data: {
          relationships: [
            { type: "membership", id: "relationship-1" },
            { type: "account", id: "relationship-2" },
          ],
        },
      };
    },
  });

  const requestPayload = { subjectId: "subject-42" };
  assert.doesNotThrow(() => adminDataExportRequestSchema.parse(requestPayload));

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: requestPayload,
    headers: validHeaders,
  });

  assert.equal(response.statusCode, 200);
  const json = response.json();
  const parsed = adminDataExportResponseSchema.parse(json);
  assert.equal(parsed.subjectId, requestPayload.subjectId);
  assert.equal(parsed.version, "2024-01-01");
  assert.equal(parsed.exportedAt, exportedAt);
  assert.equal(parsed.data.relationships.length, 2);
  assert.deepEqual(calls, [requestPayload.subjectId]);
});
