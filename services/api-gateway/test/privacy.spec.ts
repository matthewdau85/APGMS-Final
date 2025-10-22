import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp, type AdminOrgExport } from "../src/app";
import {
  createPrismaStub,
  seedOrgWithData,
  type Stub,
} from "./helpers/prisma-stub";

const ADMIN_TOKEN = "test-admin-token";
const AUTH_SECRET = "test-auth-secret";
const AUTH_ISSUER = "https://issuer.example.com";
const AUTH_AUDIENCE = "apgms-api";

let app: FastifyInstance;
let stub: Stub;

beforeEach(async () => {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.AUTH_JWT_SECRET = AUTH_SECRET;
  process.env.AUTH_JWT_ISSUER = AUTH_ISSUER;
  process.env.AUTH_JWT_AUDIENCE = AUTH_AUDIENCE;
  stub = createPrismaStub();
  app = await createApp({ prisma: stub.client as unknown as PrismaClient });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

test("admin export requires a valid admin token", async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/admin/export/example-org",
  });
  assert.equal(response.statusCode, 403);
});

test("admin export returns organisation data without secrets", async (t) => {
  seedOrgWithData(stub.state, {
    orgId: "org-123",
    userId: "user-456",
    lineId: "line-789",
  });

  const response = await app.inject({
    method: "GET",
    url: "/admin/export/org-123",
    headers: { "x-admin-token": ADMIN_TOKEN },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { export: AdminOrgExport };
  assert.ok(body.export);
  assert.equal(body.export.org.id, "org-123");
  assert.equal(body.export.users.length, 1);
  assert.deepEqual(body.export.users[0], {
    id: "user-456",
    email: "someone@example.com",
    createdAt: stub.state.users[0].createdAt.toISOString(),
  });
  assert.equal(body.export.bankLines.length, 1);
  assert.equal(body.export.bankLines[0].amount, 1200);
  assert.equal(body.export.bankLines[0].date, stub.state.bankLines[0].date.toISOString());
  assert.equal(body.export.org.deletedAt, null);
});

test("deleting an organisation soft-deletes data and records a tombstone", async (t) => {
  seedOrgWithData(stub.state, {
    orgId: "delete-me",
    userId: "delete-user",
    lineId: "delete-line",
  });

  const response = await app.inject({
    method: "DELETE",
    url: "/admin/delete/delete-me",
    headers: { "x-admin-token": ADMIN_TOKEN },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { status: string; deletedAt: string };
  assert.equal(payload.status, "deleted");
  assert.ok(Date.parse(payload.deletedAt));

  const org = stub.state.orgs.find((o) => o.id === "delete-me");
  assert.ok(org);
  assert.ok(org.deletedAt instanceof Date);

  assert.equal(stub.state.users.filter((u) => u.orgId === "delete-me").length, 0);
  assert.equal(stub.state.bankLines.filter((l) => l.orgId === "delete-me").length, 0);
  assert.equal(stub.state.tombstones.length, 1);
  const tombstone = stub.state.tombstones[0];
  const tombstonePayload = tombstone.payload as AdminOrgExport;
  assert.equal(tombstone.orgId, "delete-me");
  assert.equal(tombstonePayload.org.id, "delete-me");
  assert.equal(typeof tombstonePayload.org.deletedAt, "string");
  assert.ok(
    tombstonePayload.org.deletedAt && Date.parse(tombstonePayload.org.deletedAt)
  );
});
