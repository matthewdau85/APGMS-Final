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
>;

type Stub = {
  client: PrismaLike;
  state: State;
};

let app: FastifyInstance;
let stub: Stub;

beforeEach(async () => {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.API_KEY = "test-api-key";
  process.env.API_KEY_ORG_ID = "org-123";
  process.env.API_KEY_ROLE = "admin";
  delete process.env.AUTH_JWKS_URL;
  delete process.env.AUTH_AUDIENCE;
  delete process.env.AUTH_ISSUER;
  stub = createPrismaStub();
  app = await createApp({ prisma: stub.client as unknown as PrismaClient });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  delete process.env.API_KEY;
  delete process.env.API_KEY_ORG_ID;
  delete process.env.API_KEY_ROLE;
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

test("/users requires authentication", async () => {
  const response = await app.inject({ method: "GET", url: "/users" });
  assert.equal(response.statusCode, 401);
});

test("non-admin users receive redacted emails", async () => {
  seedOrgWithData(stub.state, {
    orgId: "org-123",
    userId: "user-redact",
    lineId: "line-redact",
  });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: {
      "x-api-key": "test-api-key",
      "x-org-id": "org-123",
      "x-user-role": "member",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { users: Array<{ email: string }> };
  assert.equal(payload.users.length, 1);
  assert.notEqual(payload.users[0].email, "someone@example.com");
  assert.ok(payload.users[0].email.includes("***"));
});

test("admin users can view full emails", async () => {
  seedOrgWithData(stub.state, {
    orgId: "org-123",
    userId: "user-admin",
    lineId: "line-admin",
  });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: {
      "x-api-key": "test-api-key",
      "x-org-id": "org-123",
      "x-user-role": "admin",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { users: Array<{ email: string }> };
  assert.equal(payload.users[0].email, "someone@example.com");
});

test("/bank-lines requires authentication", async () => {
  const response = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(response.statusCode, 401);
});

test("bank line queries are scoped to the caller organisation", async () => {
  const baseDate = new Date("2024-03-01T00:00:00Z");
  stub.state.orgs.push(
    { id: "org-123", name: "Primary", createdAt: baseDate, deletedAt: null } as OrgState,
    { id: "org-999", name: "Other", createdAt: baseDate, deletedAt: null } as OrgState,
  );
  stub.state.users.push({
    id: "user-1",
    email: "member@example.com",
    password: "hashed",
    orgId: "org-123",
    createdAt: baseDate,
  } as User);
  stub.state.bankLines.push(
    {
      id: "line-a",
      orgId: "org-123",
      date: new Date("2024-03-10T00:00:00Z"),
      amount: 500 as any,
      payee: "Vendor",
      desc: "Invoice",
      createdAt: baseDate,
    } as BankLine,
    {
      id: "line-b",
      orgId: "org-999",
      date: new Date("2024-03-12T00:00:00Z"),
      amount: 750 as any,
      payee: "Other",
      desc: "Other",
      createdAt: baseDate,
    } as BankLine,
  );

  const response = await app.inject({
    method: "GET",
    url: "/bank-lines?startDate=2024-03-01T00:00:00.000Z",
    headers: {
      "x-api-key": "test-api-key",
      "x-org-id": "org-123",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { lines: Array<{ id: string; orgId: string }> };
  assert.equal(payload.lines.length, 1);
  assert.equal(payload.lines[0].id, "line-a");
});

test("reusing an idempotency key returns the original response", async () => {
  stub.state.orgs.push({
    id: "org-123",
    name: "Org",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    deletedAt: null,
  } as OrgState);

  const payload = { amount: 123.45, date: "2024-04-01T00:00:00.000Z", memo: "First" };
  const headers = {
    "x-api-key": "test-api-key",
    "x-org-id": "org-123",
    "Idempotency-Key": "dup-key",
  };

  const first = await app.inject({ method: "POST", url: "/bank-lines", headers, payload });
  assert.equal(first.statusCode, 201);
  const second = await app.inject({ method: "POST", url: "/bank-lines", headers, payload });
  assert.equal(second.statusCode, 201);
  assert.equal(stub.state.bankLines.length, 1);
  assert.deepEqual(second.json(), first.json());
});

test("changing the payload with the same idempotency key conflicts", async () => {
  stub.state.orgs.push({
    id: "org-123",
    name: "Org",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    deletedAt: null,
  } as OrgState);

  const headers = {
    "x-api-key": "test-api-key",
    "x-org-id": "org-123",
    "Idempotency-Key": "conflict-key",
  };

  const firstPayload = { amount: 10, date: "2024-05-01T00:00:00.000Z", memo: "Initial" };
  const secondPayload = { amount: 20, date: "2024-05-01T00:00:00.000Z", memo: "Changed" };

  const first = await app.inject({ method: "POST", url: "/bank-lines", headers, payload: firstPayload });
  assert.equal(first.statusCode, 201);
  const second = await app.inject({ method: "POST", url: "/bank-lines", headers, payload: secondPayload });
  assert.equal(second.statusCode, 409);
  assert.equal(stub.state.bankLines.length, 1);
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
      findMany: async ({ select, orderBy, where }) => {
        let users = [...state.users];
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
      deleteMany: async ({ where }) => {
        const initialLength = state.users.length;
        state.users = state.users.filter((user) => user.orgId !== where?.orgId);
        return { count: initialLength - state.users.length };
      },
    },
    bankLine: {
      findMany: async ({ orderBy, take, skip, where }) => {
        let lines = [...state.bankLines];
        if (where?.orgId) {
          lines = lines.filter((line) => line.orgId === where.orgId);
        }
        const dateFilter = where?.date as { gte?: Date; lte?: Date } | undefined;
        if (dateFilter?.gte) {
          lines = lines.filter((line) => line.date >= dateFilter.gte!);
        }
        if (dateFilter?.lte) {
          lines = lines.filter((line) => line.date <= dateFilter.lte!);
        }
        if (orderBy?.date === "desc") {
          lines.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        if (typeof skip === "number" && skip > 0) {
          lines = lines.slice(skip);
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
          payee: data.payee ?? "",
          desc: data.desc ?? "",
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
