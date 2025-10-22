import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";

const ADMIN_TOKEN = "test-admin-token";

type UserRow = {
  id: string;
  email: string;
  orgId: string;
  createdAt: Date;
  phone?: string;
  bsb?: string;
  account?: string;
};

let app: FastifyInstance;
let users: UserRow[];

beforeEach(async () => {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  users = [
    {
      id: "user-1",
      email: "alice@example.com",
      orgId: "org-1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      phone: "0412345678",
      bsb: "123456",
      account: "987654321",
    },
  ];

  const prismaStub = createPrismaStub(users);
  app = await createApp({ prisma: prismaStub as unknown as PrismaClient });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  delete process.env.ADMIN_TOKEN;
});

test("non-admin sees masked email/phone", async () => {
  const response = await app.inject({ method: "GET", url: "/users" });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { users: Array<Record<string, unknown>> };
  const [user] = body.users;

  assert.equal(user.email, "a***@example.com");
  assert.equal(user.phone, "••••••••78");
  assert.equal(user.bsb, "••3456");
  assert.equal(user.account, "•••••4321");
});

test("admin sees raw PII", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { "x-admin-token": ADMIN_TOKEN },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { users: Array<Record<string, unknown>> };
  const [user] = body.users;

  assert.equal(user.email, users[0].email);
  assert.equal(user.phone, users[0].phone);
  assert.equal(user.bsb, users[0].bsb);
  assert.equal(user.account, users[0].account);
});

function createPrismaStub(userRows: UserRow[]) {
  const stub: Record<string, any> = {};

  Object.assign(stub, {
    org: {
      findUnique: async () => null,
      update: async () => null,
    },
    user: {
      findMany: async () => userRows.map((user) => ({ ...user })),
      deleteMany: async () => ({ count: 0 }),
    },
    bankLine: {
      findMany: async () => [],
      upsert: async () => ({}),
      create: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    orgTombstone: {
      create: async () => ({ id: "tombstone" }),
    },
    $transaction: async <T>(fn: (client: typeof stub) => Promise<T>) => fn(stub),
    $queryRaw: async () => [{ ok: 1 }],
  });

  return stub;
}
