import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { BankLine, Org, PrismaClient, User } from "@prisma/client";

import { createApp } from "../src/app";
import { createPrismaStub, type Stub } from "./helpers/prisma-stub";

const AUTH_SECRET = "test-auth-secret";
const AUTH_ISSUER = "https://issuer.example.com";
const AUTH_AUDIENCE = "apgms-api";
const ADMIN_TOKEN = "test-admin-token";

let app: FastifyInstance;
let stub: Stub;

beforeEach(async () => {
  process.env.AUTH_JWT_SECRET = AUTH_SECRET;
  process.env.AUTH_JWT_ISSUER = AUTH_ISSUER;
  process.env.AUTH_JWT_AUDIENCE = AUTH_AUDIENCE;
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;

  stub = createPrismaStub();
  app = await createApp({ prisma: stub.client as unknown as PrismaClient });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

test("/users requires authentication", async () => {
  const response = await app.inject({ method: "GET", url: "/users" });
  assert.equal(response.statusCode, 401);
});

test("/bank-lines requires authentication", async () => {
  const response = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(response.statusCode, 401);
});

test("/users returns 403 when the user is unknown", async () => {
  const token = await buildToken({ sub: "missing", orgId: "org-1", email: "missing@example.com" });
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 403);
});

test("/users only returns users from the caller's organisation", async () => {
  seedOrg("org-1", "Org One");
  seedOrg("org-2", "Org Two");
  const firstCreated = new Date("2024-01-01T00:00:00Z");
  const secondCreated = new Date("2023-01-01T00:00:00Z");
  seedUser({ id: "user-1", email: "user1@example.com", orgId: "org-1", createdAt: firstCreated });
  seedUser({ id: "user-2", email: "user2@example.com", orgId: "org-2", createdAt: secondCreated });

  const token = await buildToken({ sub: "user-1", orgId: "org-1", email: "user1@example.com" });
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { users: Array<{ id: string; email: string; createdAt: string }> };
  assert.deepEqual(body.users, [
    {
      id: "user-1",
      email: "user1@example.com",
      createdAt: firstCreated.toISOString(),
    },
  ]);
});

test("/bank-lines only returns lines for the caller's organisation", async () => {
  seedOrg("org-1", "Org One");
  seedOrg("org-2", "Org Two");
  seedUser({ id: "user-1", email: "user1@example.com", orgId: "org-1" });
  seedLine({
    id: "line-1",
    orgId: "org-1",
    date: new Date("2024-03-03T00:00:00Z"),
    amount: 1200 as any,
    payee: "Vendor A",
    desc: "Invoice",
  });
  seedLine({
    id: "line-2",
    orgId: "org-2",
    date: new Date("2024-02-02T00:00:00Z"),
    amount: 900 as any,
    payee: "Vendor B",
    desc: "Invoice",
  });

  const token = await buildToken({ sub: "user-1", orgId: "org-1", email: "user1@example.com" });
  const response = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { lines: Array<{ id: string; orgId: string }> };
  assert.equal(body.lines.length, 1);
  assert.equal(body.lines[0].id, "line-1");
  assert.equal(body.lines[0].orgId, "org-1");
});

test("/bank-lines rejects mismatched organisation IDs in the payload", async () => {
  seedOrg("org-1", "Org One");
  seedOrg("org-2", "Org Two");
  seedUser({ id: "user-1", email: "user1@example.com", orgId: "org-1" });

  const token = await buildToken({ sub: "user-1", orgId: "org-1", email: "user1@example.com" });
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-2",
      date: new Date("2024-04-01T00:00:00Z").toISOString(),
      amount: "100.00",
      payee: "Other",
      desc: "Mismatch",
    },
  });

  assert.equal(response.statusCode, 403);
});

test("/bank-lines creates a new line for the caller's organisation", async () => {
  seedOrg("org-1", "Org One");
  seedUser({ id: "user-1", email: "user1@example.com", orgId: "org-1" });

  const token = await buildToken({ sub: "user-1", orgId: "org-1", email: "user1@example.com" });
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      date: new Date("2024-05-05T00:00:00Z").toISOString(),
      amount: "42.50",
      payee: "Cafe",
      desc: "Lunch",
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json() as { orgId: string; payee: string; idempotencyKey: string | null };
  assert.equal(body.orgId, "org-1");
  assert.equal(body.payee, "Cafe");
  assert.equal(body.idempotencyKey, null);
  assert.equal(stub.state.bankLines.length, 1);
  assert.equal(stub.state.bankLines[0].orgId, "org-1");
});

test("/bank-lines honours idempotency keys", async () => {
  seedOrg("org-1", "Org One");
  seedUser({ id: "user-1", email: "user1@example.com", orgId: "org-1" });

  const token = await buildToken({ sub: "user-1", orgId: "org-1", email: "user1@example.com" });
  const payload = {
    date: new Date("2024-06-06T00:00:00Z").toISOString(),
    amount: "99.00",
    payee: "Supplier",
    desc: "Subscription",
  };
  const headers = {
    authorization: `Bearer ${token}`,
    "idempotency-key": "unique-key-123",
  } as const;

  const first = await app.inject({ method: "POST", url: "/bank-lines", headers, payload });
  assert.equal(first.statusCode, 200);
  assert.equal(stub.state.bankLines.length, 1);

  const second = await app.inject({ method: "POST", url: "/bank-lines", headers, payload });
  assert.equal(second.statusCode, 200);
  assert.equal(second.headers["idempotency-status"], "reused");
  const firstBody = first.json();
  const secondBody = second.json();
  assert.deepEqual(secondBody, firstBody);
  assert.equal(stub.state.bankLines.length, 1);
});

async function buildToken(claims: { sub: string; orgId: string; email?: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: claims.sub,
    orgId: claims.orgId,
    email: claims.email,
    iss: AUTH_ISSUER,
    aud: AUTH_AUDIENCE,
    iat: now,
    exp: now + 300,
  };
  const headerSegment = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", Buffer.from(AUTH_SECRET, "utf8"))
    .update(`${headerSegment}.${payloadSegment}`)
    .digest("base64url");
  return `${headerSegment}.${payloadSegment}.${signature}`;
}

function seedOrg(id: string, name: string) {
  stub.state.orgs.push({
    id,
    name,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    deletedAt: null,
  } as Org & { deletedAt: Date | null });
}

function seedUser({ id, email, orgId, createdAt }: { id: string; email: string; orgId: string; createdAt?: Date }) {
  stub.state.users.push({
    id,
    email,
    password: "hashed-password",
    orgId,
    createdAt: createdAt ?? new Date("2024-01-01T00:00:00Z"),
  } as User);
}

function seedLine(line: { id: string; orgId: string; date: Date; amount: any; payee: string; desc: string }) {
  stub.state.bankLines.push({
    id: line.id,
    orgId: line.orgId,
    date: line.date,
    amount: line.amount,
    payee: line.payee,
    desc: line.desc,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    idempotencyKey: null,
  } as BankLine);
}
