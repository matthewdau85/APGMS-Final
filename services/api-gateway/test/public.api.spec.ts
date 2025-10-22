import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";

import type { BankLine, PrismaClient, User } from "@prisma/client";

import { createApp } from "../src/app";

type PrismaLike = {
  user: {
    findMany: (args?: {
      where?: { orgId?: string };
      select?: { id?: boolean; email?: boolean; createdAt?: boolean };
      orderBy?: { createdAt?: "asc" | "desc" };
    }) => Promise<Array<{ id?: string; email?: string; createdAt?: Date }>>;
  };
  bankLine: {
    findMany: (args?: {
      orderBy?: { date?: "asc" | "desc"; amount?: "asc" | "desc" };
      take?: number;
      skip?: number;
    }) => Promise<BankLine[]>;
  };
};

type State = {
  users: User[];
  bankLines: BankLine[];
};

const buildToken = (principal: { id: string; orgId: string; role: "admin" | "user"; email: string }) =>
  `Bearer ${Buffer.from(JSON.stringify(principal)).toString("base64url")}`;

const createStub = (initial: Partial<State> = {}): { state: State; client: PrismaLike } => {
  const state: State = {
    users: (initial.users ?? []).map((user) => ({ ...user })),
    bankLines: (initial.bankLines ?? []).map((line) => ({ ...line })),
  };

  const client: PrismaLike = {
    user: {
      findMany: async (args = {}) => {
        const { where, select, orderBy } = args;
        let users = state.users.map((user) => ({ ...user }));
        if (where?.orgId) {
          users = users.filter((user) => user.orgId === where.orgId);
        }
        if (orderBy?.createdAt === "desc") {
          users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (select) {
          return users.map((user) => pick(user, select));
        }
        return users;
      },
    },
    bankLine: {
      findMany: async (args = {}) => {
        const { orderBy, take, skip } = args;
        let lines = state.bankLines.map((line) => ({ ...line }));
        if (orderBy?.date) {
          const dir = orderBy.date === "asc" ? 1 : -1;
          lines.sort((a, b) => dir * (a.date.getTime() - b.date.getTime()));
        } else if (orderBy?.amount) {
          const dir = orderBy.amount === "asc" ? 1 : -1;
          lines.sort((a, b) => dir * (Number(a.amount as any) - Number(b.amount as any)));
        }
        if (typeof skip === "number" && skip > 0) {
          lines = lines.slice(skip);
        }
        if (typeof take === "number") {
          lines = lines.slice(0, take);
        }
        return lines as BankLine[];
      },
    },
  };

  return { state, client };
};

const pick = (value: User, select: Record<string, boolean>) => {
  const result: Record<string, unknown> = {};
  for (const [key, include] of Object.entries(select)) {
    if (include && key in value) {
      result[key] = (value as any)[key];
    }
  }
  return result as { id?: string; email?: string; createdAt?: Date };
};

const buildApp = async (state: Partial<State> = {}) => {
  const stub = createStub(state);
  const app = await createApp({ prisma: stub.client as unknown as PrismaClient });
  await app.ready();
  return { app, stub };
};

test("GET /bank-lines validates query parameters", async () => {
  const { app } = await buildApp({
    bankLines: [
      {
        id: "line-1",
        orgId: "org-1",
        date: new Date("2024-01-01T00:00:00Z"),
        amount: 100 as any,
        payee: "Vendor A",
        desc: "Payment",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      } as BankLine,
    ],
  });

  const invalidTake = await app.inject({ method: "GET", url: "/bank-lines?take=999" });
  assert.equal(invalidTake.statusCode, 400);

  const invalidSort = await app.inject({ method: "GET", url: "/bank-lines?sort=createdAt" });
  assert.equal(invalidSort.statusCode, 400);

  await app.close();
});

test("GET /bank-lines enforces pagination and sorting bounds", async () => {
  const { app } = await buildApp({
    bankLines: [
      {
        id: "line-a",
        orgId: "org-1",
        date: new Date("2024-03-01T00:00:00Z"),
        amount: 300 as any,
        payee: "Vendor B",
        desc: "Invoice B",
        createdAt: new Date("2024-03-01T00:00:00Z"),
      } as BankLine,
      {
        id: "line-b",
        orgId: "org-1",
        date: new Date("2024-02-01T00:00:00Z"),
        amount: 200 as any,
        payee: "Vendor C",
        desc: "Invoice C",
        createdAt: new Date("2024-02-01T00:00:00Z"),
      } as BankLine,
      {
        id: "line-c",
        orgId: "org-1",
        date: new Date("2024-01-01T00:00:00Z"),
        amount: 100 as any,
        payee: "Vendor A",
        desc: "Invoice A",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      } as BankLine,
    ],
  });

  const response = await app.inject({
    method: "GET",
    url: "/bank-lines?take=1&skip=1&sort=amount&direction=asc",
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { lines: Array<{ id: string }> };
  assert.equal(payload.lines.length, 1);
  assert.equal(payload.lines[0].id, "line-b");

  await app.close();
});

test("GET /users requires a valid principal", async () => {
  const { app } = await buildApp();

  const response = await app.inject({ method: "GET", url: "/users" });
  assert.equal(response.statusCode, 401);

  const malformed = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: "Bearer invalid" },
  });
  assert.equal(malformed.statusCode, 401);

  await app.close();
});

test("GET /users redacts email addresses and scopes by org", async () => {
  const now = new Date("2024-05-01T12:00:00Z");
  const { app } = await buildApp({
    users: [
      {
        id: "user-1",
        email: "alice@example.com",
        password: "hash",
        orgId: "org-1",
        createdAt: now,
      } as User,
      {
        id: "user-2",
        email: "bob@example.com",
        password: "hash",
        orgId: "org-2",
        createdAt: now,
      } as User,
    ],
  });

  const token = buildToken({
    id: randomUUID(),
    orgId: "org-1",
    role: "user",
    email: "principal@example.com",
  });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: token },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { users: Array<{ id: string; email: string; createdAt: string }> };
  assert.equal(body.users.length, 1);
  assert.equal(body.users[0].id, "user-1");
  assert.equal(body.users[0].email, "a***e@example.com");
  assert.equal(body.users[0].createdAt, now.toISOString());

  await app.close();
});

