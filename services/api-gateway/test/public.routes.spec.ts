import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import type { FastifyInstance } from "fastify";
import { Prisma, type PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";

interface UserRecord {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
  orgId: string;
}

interface BankLineRecord {
  id: string;
  orgId: string;
  date: Date;
  amount: Prisma.Decimal;
  payee: string;
  desc: string;
  createdAt: Date;
  idempotencyKey?: string | null;
}

type PrismaStubState = {
  users: UserRecord[];
  bankLines: BankLineRecord[];
};

type PrismaStub = {
  client: Pick<
    PrismaClient,
    "user" | "bankLine"
  >;
  state: PrismaStubState;
};

function createPrismaStub(initial?: Partial<PrismaStubState>): PrismaStub {
  const state: PrismaStubState = {
    users: initial?.users ?? [],
    bankLines: initial?.bankLines ?? [],
  };

  const client: PrismaStub["client"] = {
    user: {
      findMany: async ({ select, orderBy } = {}) => {
        let results = [...state.users];
        if (orderBy?.createdAt === "desc") {
          results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (select) {
          return results.map((user) => pick(user, select));
        }
        return results;
      },
    },
    bankLine: {
      findMany: async ({ orderBy, take, select } = {}) => {
        let results = [...state.bankLines];
        if (orderBy?.date === "desc") {
          results.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        if (typeof take === "number") {
          results = results.slice(0, take);
        }
        if (select) {
          return results.map((line) => pick(line, select));
        }
        return results;
      },
    },
  } as unknown as PrismaStub["client"];

  return { client, state };
}

function pick<T extends Record<string, unknown>>(value: T, select: Record<string, boolean>) {
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, include]) => include)
      .map(([key]) => [key, value[key]]),
  );
}

let app: FastifyInstance;
let stub: PrismaStub;

beforeEach(async () => {
  stub = createPrismaStub({
    users: [
      {
        id: "user-123",
        email: "someone@example.com",
        password: "super-secret",
        orgId: "org-1",
        createdAt: new Date("2024-02-01T10:00:00.000Z"),
      },
    ],
    bankLines: [
      {
        id: "line-456",
        orgId: "org-1",
        date: new Date("2024-02-03T12:30:00.000Z"),
        amount: new Prisma.Decimal("1234.56"),
        payee: "Helios Storage",
        desc: "Term sheet expansion",
        createdAt: new Date("2024-02-03T13:00:00.000Z"),
        idempotencyKey: "idem-123",
      },
    ],
  });

  app = await createApp({ prisma: stub.client as unknown as PrismaClient });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

test("masks sensitive user details", async () => {
  const response = await app.inject({ method: "GET", url: "/users" });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { users: Array<Record<string, unknown>> };
  assert.deepEqual(payload, {
    users: [
      {
        id: "user-123",
        email: "s*****e@example.com",
        createdAt: stub.state.users[0].createdAt.toISOString(),
      },
    ],
  });
  assert.equal("orgId" in (payload.users[0] ?? {}), false);
});

test("validates the bank line query parameters", async () => {
  const response = await app.inject({ method: "GET", url: "/bank-lines?take=0" });

  assert.equal(response.statusCode, 400);
  const body = response.json() as { error: string };
  assert.equal(body.error, "invalid_query");
});

test("omits sensitive bank line fields", async () => {
  const response = await app.inject({ method: "GET", url: "/bank-lines" });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { lines: Array<Record<string, unknown>> };
  assert.deepEqual(payload, {
    lines: [
      {
        id: "line-456",
        date: stub.state.bankLines[0].date.toISOString(),
        amount: "1234.56",
        payee: "Helios Storage",
        desc: "Term sheet expansion",
        createdAt: stub.state.bankLines[0].createdAt.toISOString(),
      },
    ],
  });
  const line = payload.lines[0] ?? {};
  assert.equal("orgId" in line, false);
  assert.equal("idempotencyKey" in line, false);
});
