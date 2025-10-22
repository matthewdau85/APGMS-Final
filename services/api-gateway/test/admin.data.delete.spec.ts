import assert from "node:assert/strict";
import { test } from "node:test";

import Fastify from "fastify";

import {
  registerAdminDataRoutes,
  type SecurityLogPayload,
} from "../src/routes/admin.data";
import { adminDataDeleteResponseSchema } from "../src/schemas/admin.data";

const ADMIN_TOKEN = "test-admin-token";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;

type DeleteResult = {
  subjectId: string;
  orgId: string;
  deletedAt: Date;
};

type BuildOptions = {
  deleteSubject?: (subjectId: string) => Promise<DeleteResult | null>;
};

const buildApp = async (options: BuildOptions = {}) => {
  const secLogCalls: SecurityLogPayload[] = [];
  const app = Fastify({ logger: false });
  await registerAdminDataRoutes(app, {
    deleteSubject: options.deleteSubject,
    secLog: (payload) => {
      secLogCalls.push(payload);
    },
  });
  await app.ready();
  return { app, secLogCalls };
};

test("401 when Authorization header is missing", async (t) => {
  const { app } = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/delete",
    payload: { subjectId: "subject-1" },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("401 when Authorization token does not match", async (t) => {
  const { app } = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/delete",
    payload: { subjectId: "subject-1" },
    headers: { authorization: "Bearer wrong" },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("400 when body is invalid", async (t) => {
  const { app } = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/delete",
    payload: {},
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "Bad Request");
});

test("404 when delete service cannot locate subject", async (t) => {
  const { app } = await buildApp({
    deleteSubject: async () => null,
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/delete",
    payload: { subjectId: "missing" },
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: "not_found" });
});

test("202 when delete succeeds", async (t) => {
  const deletedAt = new Date("2024-02-02T10:20:30.000Z");
  let calls: string[] = [];
  const { app, secLogCalls } = await buildApp({
    deleteSubject: async (subjectId) => {
      calls.push(subjectId);
      return {
        subjectId,
        orgId: "org-1",
        deletedAt,
      };
    },
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/delete",
    payload: { subjectId: "subject-123" },
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  assert.equal(response.statusCode, 202);
  const json = response.json();
  const parsed = adminDataDeleteResponseSchema.parse(json);
  assert.equal(parsed.subjectId, "subject-123");
  assert.equal(parsed.status, "deleted");
  assert.equal(parsed.deletedAt, deletedAt.toISOString());
  assert.deepEqual(calls, ["subject-123"]);

  assert.equal(secLogCalls.length, 1);
  assert.deepEqual(secLogCalls[0], {
    event: "admin_data_delete",
    orgId: "org-1",
    principal: "admin_token",
    subjectId: "subject-123",
    occurredAt: deletedAt.toISOString(),
  });
});
