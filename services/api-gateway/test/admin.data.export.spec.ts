import assert from "node:assert/strict";
import { test } from "node:test";

import Fastify from "fastify";

import {
  registerAdminDataRoutes,
  type SecurityLogPayload,
} from "../src/routes/admin.data";
import {
  adminDataExportRequestSchema,
  adminDataExportResponseSchema,
} from "../src/schemas/admin.data";

const ADMIN_TOKEN = "test-admin-token";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;

type SubjectExportRecord = {
  subjectId: string;
  orgId: string;
  createdAt: Date;
  bankLineCount: number;
};

type BuildAppOptions = {
  getSubjectExport?: (subjectId: string) => Promise<SubjectExportRecord | null>;
};

const buildApp = async (options: BuildAppOptions = {}) => {
  const secLogCalls: SecurityLogPayload[] = [];
  const app = Fastify({ logger: false });
  await registerAdminDataRoutes(app, {
    getSubjectExport: options.getSubjectExport,
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
    url: "/admin/data/export",
    payload: { subjectId: "subject-1" },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("401 when token does not match", async (t) => {
  const { app } = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { subjectId: "subject-1" },
    headers: { authorization: "Bearer wrong" },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "unauthorized" });
});

test("400 when request payload is invalid", async (t) => {
  const { app } = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: {},
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "Bad Request");
});

test("404 when export record is not found", async (t) => {
  const { app } = await buildApp({
    getSubjectExport: async () => null,
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { subjectId: "missing" },
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: "not_found" });
});

test("200 when export succeeds", async (t) => {
  const record: SubjectExportRecord = {
    subjectId: "subject-99",
    orgId: "org-55",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    bankLineCount: 7,
  };

  let fetchCalls: string[] = [];
  const { app, secLogCalls } = await buildApp({
    getSubjectExport: async (subjectId) => {
      fetchCalls.push(subjectId);
      return record;
    },
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { subjectId: record.subjectId },
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  assert.equal(response.statusCode, 200);
  const json = response.json();
  const parsedRequest = adminDataExportRequestSchema.parse({
    subjectId: record.subjectId,
  });
  assert.equal(parsedRequest.subjectId, record.subjectId);

  const parsedResponse = adminDataExportResponseSchema.parse(json);
  assert.equal(parsedResponse.subject.id, record.subjectId);
  assert.equal(parsedResponse.subject.orgId, record.orgId);
  assert.equal(parsedResponse.relationships.bankLineCount, record.bankLineCount);
  assert.ok(Date.parse(parsedResponse.exportedAt));
  assert.ok(Date.parse(parsedResponse.subject.createdAt));
  assert.equal(parsedResponse.metadata.redactedFields.includes("email"), true);
  assert.equal(parsedResponse.metadata.redactedFields.includes("password"), true);

  assert.deepEqual(fetchCalls, [record.subjectId]);
  assert.equal(secLogCalls.length, 1);
  assert.deepEqual(secLogCalls[0], {
    event: "admin_data_export",
    orgId: record.orgId,
    principal: "admin_token",
    subjectId: record.subjectId,
    occurredAt: parsedResponse.exportedAt,
  });
});
