import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";
import { hashPassword } from "@apgms/shared";

type UserRecord = {
  id: string;
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
};

type PrismaStub = {
  user: {
    findUnique: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any>;
  };
  bankLine: {
    findMany: (args: any) => Promise<any>;
  };
  org: Record<string, unknown>;
  orgTombstone: Record<string, unknown>;
  $transaction: <T>(cb: (tx: any) => Promise<T>) => Promise<T>;
  $queryRaw: (...args: any[]) => Promise<unknown>;
};

let app: FastifyInstance;
let prismaStub: PrismaStub;
let users: UserRecord[];
let bankLines: BankLineRecord[];

beforeEach(async () => {
  process.env.JWT_SECRET = "test-secret";
  users = [
    {
      id: "user-1",
      email: "founder@example.com",
      password: await hashPassword("Supersafe123"),
      orgId: "org-1",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    },
  ];
  bankLines = [
    {
      id: "line-1",
      orgId: "org-1",
      date: new Date("2024-02-01T00:00:00.000Z"),
      amount: 1250.75,
      payee: "Acme",
      desc: "Office fit-out",
      createdAt: new Date("2024-02-02T00:00:00.000Z"),
    },
    {
      id: "line-2",
      orgId: "org-2",
      date: new Date("2024-02-03T00:00:00.000Z"),
      amount: 999,
      payee: "Other Org",
      desc: "Should not leak",
      createdAt: new Date("2024-02-04T00:00:00.000Z"),
    },
  ];

  prismaStub = {
    user: {
      findUnique: async ({ where, select }) => {
        const record = users.find((user) => user.email === where?.email);
        if (!record) {
          return null;
        }
        if (!select) {
          return { ...record, org: { deletedAt: null } };
        }
        const result: Record<string, unknown> = {};
        if (select.id) result.id = record.id;
        if (select.email) result.email = record.email;
        if (select.password) result.password = record.password;
        if (select.orgId) result.orgId = record.orgId;
        if (select.createdAt) result.createdAt = record.createdAt;
        if (select.org) {
          result.org = { deletedAt: null };
        }
        return result;
      },
      findMany: async ({ where, select, orderBy }) => {
        let results = users.filter((user) => {
          if (!where?.orgId) {
            return true;
          }
          return user.orgId === where.orgId;
        });
        if (orderBy?.createdAt === "desc") {
          results = [...results].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (!select) {
          return results;
        }
        return results.map((user) => {
          const picked: Record<string, unknown> = {};
          if (select.id) picked.id = user.id;
          if (select.email) picked.email = user.email;
          if (select.createdAt) picked.createdAt = user.createdAt;
          return picked;
        });
      },
    },
    bankLine: {
      findMany: async ({ where, orderBy, take }) => {
        let results = bankLines.filter((line) => {
          if (!where?.orgId) {
            return true;
          }
          return line.orgId === where.orgId;
        });
        if (orderBy?.date === "desc") {
          results = [...results].sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        if (typeof take === "number") {
          results = results.slice(0, take);
        }
        return results;
      },
    },
    org: {},
    orgTombstone: {},
    $transaction: async (cb) => cb(prismaStub),
    $queryRaw: async () => 1,
  };

  app = await createApp({ prisma: prismaStub as unknown as PrismaClient });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

test("GET /users requires authentication", async () => {
  const res = await app.inject({ method: "GET", url: "/users" });
  assert.equal(res.statusCode, 401);
});

test("successful login returns a JWT", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@example.com", password: "Supersafe123" },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { token: string; tokenType: string; expiresIn: number };
  assert.equal(body.tokenType, "Bearer");
  assert.equal(typeof body.token, "string");
  assert.equal(body.expiresIn, 15 * 60);
});

test("authenticated callers only see masked users from their org", async () => {
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@example.com", password: "Supersafe123" },
  });
  const { token } = login.json() as { token: string };
  const res = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { users: Array<{ id: string; email: string; createdAt: string }> };
  assert.equal(body.users.length, 1);
  assert.equal(body.users[0].id, "user-1");
  assert.equal(body.users[0].email.startsWith("f"), true);
  assert.equal(body.users[0].email.includes("@example.com"), true);
});

test("bank lines are scoped to the authenticated org", async () => {
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@example.com", password: "Supersafe123" },
  });
  const { token } = login.json() as { token: string };
  const res = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { lines: Array<{ id: string; orgId: string }> };
  assert.equal(body.lines.length, 1);
  assert.equal(body.lines[0].orgId, "org-1");
  assert.equal(body.lines[0].id, "line-1");
});

test("clients cannot create bank lines for other organisations", async () => {
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@example.com", password: "Supersafe123" },
  });
  const { token } = login.json() as { token: string };
  const res = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-2",
      date: new Date().toISOString(),
      amount: "100.00",
      payee: "Test",
      desc: "Attempted breach",
    },
  });
  assert.equal(res.statusCode, 403);
});
