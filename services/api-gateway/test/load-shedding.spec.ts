import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";
import { hashPassword } from "@apgms/shared";

type PrismaStub = {
  user: {
    findUnique: (args: any) => Promise<any>;
  };
  bankLine: {
    create: (args: any) => Promise<any>;
  };
  $queryRaw: (...args: any[]) => Promise<unknown>;
  $transaction: <T>(cb: (tx: any) => Promise<T>) => Promise<T>;
};

let app: FastifyInstance;
let prismaStub: PrismaStub;
let createCalls = 0;

beforeEach(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.ADMIN_EMAIL_ALLOWLIST = "";
  createCalls = 0;

  prismaStub = {
    user: {
      findUnique: async ({ where, select }) => {
        if (where?.email !== "founder@example.com") {
          return null;
        }
        const base = {
          id: "user-1",
          email: "founder@example.com",
          password: await hashPassword("Supersafe123"),
          orgId: "org-1",
          org: { deletedAt: null },
        };
        if (!select) {
          return base;
        }
        const result: Record<string, unknown> = {};
        if (select.id) result.id = base.id;
        if (select.email) result.email = base.email;
        if (select.password) result.password = base.password;
        if (select.orgId) result.orgId = base.orgId;
        if (select.org) result.org = base.org;
        return result;
      },
    },
    bankLine: {
      create: async () => {
        createCalls += 1;
        throw new Error("db_down");
      },
    },
    $queryRaw: async () => 1,
    $transaction: async (cb) => cb(prismaStub),
  };

  app = await createApp({ prisma: prismaStub as unknown as PrismaClient });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

test("load shedding blocks write traffic after repeated dependency failures", async () => {
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@example.com", password: "Supersafe123" },
  });
  assert.equal(login.statusCode, 200);
  const { token } = login.json() as { token: string };

  const payload = {
    date: new Date().toISOString(),
    amount: "10.50",
    payee: "Vendor",
    desc: "Test",
  };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  assert.equal(first.statusCode, 400);

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  assert.equal(second.statusCode, 400);

  const third = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  assert.equal(third.statusCode, 503);
  const body = third.json() as Record<string, unknown>;
  assert.equal(body.error, "load_shedding");
  assert.equal(body.dependency, "database");
  assert.ok(third.headers["retry-after"]);
  assert.equal(createCalls, 2);
});
