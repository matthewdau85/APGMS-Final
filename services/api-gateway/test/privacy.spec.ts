import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { BankLine, Org, PrismaClient, User } from "@prisma/client";

import { createApp, type AdminOrgExport } from "../src/app";

const ADMIN_TOKEN = "test-admin-token";

type OrgState = Org & { deletedAt: Date | null };

type State = {
  orgs: OrgState[];
  users: User[];
  bankLines: BankLine[];
  tombstones: Array<{ id: string; orgId: string; payload: AdminOrgExport; createdAt: Date }>;
};

type TransactionCallback<T> = (tx: PrismaLike) => Promise<T>;

type PrismaLike = Pick<
  PrismaClient,
  | "org"
  | "user"
  | "bankLine"
  | "orgTombstone"
  | "$transaction"
  | "$disconnect"
  | "$queryRaw"
>;

type Stub = {
  client: PrismaLike;
  state: State;
};

let app: FastifyInstance;
let stub: Stub;

beforeEach(async () => {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
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
  assert.equal(tombstone.orgId, "delete-me");
  assert.equal(tombstone.payload.org.id, "delete-me");
  assert.equal(typeof tombstone.payload.org.deletedAt, "string");
  assert.ok(tombstone.payload.org.deletedAt && Date.parse(tombstone.payload.org.deletedAt));
});

function createPrismaStub(initial?: Partial<State>): Stub {
  const state: State = {
    orgs: initial?.orgs ?? [],
    users: initial?.users ?? [],
    bankLines: initial?.bankLines ?? [],
    tombstones: initial?.tombstones ?? [],
  };

  const client: PrismaLike = {
    org: {
      findUnique: async ({ where, include }) => {
        const org = state.orgs.find((o) => o.id === where.id);
        if (!org) return null;
        if (include?.users || include?.lines) {
          return {
            ...org,
            users: state.users.filter((user) => user.orgId === org.id),
            lines: state.bankLines.filter((line) => line.orgId === org.id),
          } as unknown as Org;
        }
        return { ...org } as Org;
      },
      update: async ({ where, data }) => {
        const org = state.orgs.find((o) => o.id === where.id);
        if (!org) throw new Error("Org not found");
        Object.assign(org, data);
        return { ...org } as Org;
      },
    },
    user: {
      findMany: async ({ select, orderBy }) => {
        let users = [...state.users];
        if (orderBy?.createdAt === "desc") {
          users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (select) {
          return users.map((user) => pick(user, select));
        }
        return users;
      },
      deleteMany: async ({ where }) => {
        const initialLength = state.users.length;
        state.users = state.users.filter((user) => user.orgId !== where?.orgId);
        return { count: initialLength - state.users.length };
      },
    },
    bankLine: {
      findMany: async ({ orderBy, take }) => {
        let lines = [...state.bankLines];
        if (orderBy?.date === "desc") {
          lines.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        if (typeof take === "number") {
          lines = lines.slice(0, take);
        }
        return lines;
      },
      create: async ({ data }) => {
        const created = {
          id: data.id ?? randomUUID(),
          orgId: data.orgId!,
          date: data.date as Date,
          amount: data.amount as any,
          payee: data.payee!,
          desc: data.desc!,
          createdAt: data.createdAt ?? new Date(),
        } as unknown as BankLine;
        state.bankLines.push(created);
        return created;
      },
      deleteMany: async ({ where }) => {
        const initialLength = state.bankLines.length;
        state.bankLines = state.bankLines.filter((line) => line.orgId !== where?.orgId);
        return { count: initialLength - state.bankLines.length };
      },
    },
    orgTombstone: {
      create: async ({ data }) => {
        const record = {
          id: data.id ?? randomUUID(),
          orgId: data.orgId!,
          payload: data.payload as AdminOrgExport,
          createdAt: data.createdAt ?? new Date(),
        };
        state.tombstones.push(record);
        return record;
      },
    },
    $transaction: async <T>(callback: TransactionCallback<T>) => {
      return callback(client);
    },
    $disconnect: async () => {
      // no-op for tests
    },
    $queryRaw: async () => 1,
  } as unknown as PrismaLike;

  return { client, state };
}

function seedOrgWithData(state: State, ids: { orgId: string; userId: string; lineId: string }) {
  const createdAt = new Date("2024-01-01T00:00:00Z");
  state.orgs.push({
    id: ids.orgId,
    name: "Example Org",
    createdAt,
    deletedAt: null,
  } as OrgState);
  state.users.push({
    id: ids.userId,
    email: "someone@example.com",
    password: "hashed-password",
    orgId: ids.orgId,
    createdAt,
  } as User);
  state.bankLines.push({
    id: ids.lineId,
    orgId: ids.orgId,
    date: new Date("2024-02-02T00:00:00Z"),
    amount: 1200 as any,
    payee: "Vendor",
    desc: "Invoice",
    createdAt,
  } as BankLine);
}

function pick<T>(value: T, select: Record<string, boolean>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, include] of Object.entries(select)) {
    if (include && key in (value as any)) {
      result[key] = (value as any)[key];
    }
  }
  return result;
}
