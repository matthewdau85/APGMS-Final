import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";

import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { FastifyInstance } from "fastify";

import { configurePIIProviders, encryptPII } from "../src/lib/pii";
import { hashIdentifier } from "../src/lib/auth";
import { createKeyManagementService, createSaltProvider } from "../src/security/providers";

const runPrivacySuite = process.env.RUN_PRIVACY_SUITE === "true";

if (!runPrivacySuite) {
  test.skip("Privacy integration suite requires RUN_PRIVACY_SUITE=true", () => {});
} else {
  const { createApp } = await import("../src/app");
  type AdminOrgExport = import("../src/app").AdminOrgExport;
  type Org = {
    id: string;
    name: string;
    createdAt: Date;
    deletedAt: Date | null;
  };
  type User = {
    id: string;
    email: string;
    createdAt: Date;
    orgId: string;
  };
  type BankLine = {
    id: string;
    orgId: string;
    date: Date;
    amount: number;
    payeeCiphertext: string;
    payeeKid: string;
    descCiphertext: string;
    descKid: string;
    createdAt: Date;
  };

const JWT_AUDIENCE = "urn:apgms:test";
const JWT_ISSUER = "urn:apgms:issuer";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "test-key";
publicJwk.alg = "RS256";

process.env.AUTH_AUDIENCE = JWT_AUDIENCE;
process.env.AUTH_ISSUER = JWT_ISSUER;
process.env.AUTH_JWKS = JSON.stringify({ keys: [publicJwk] });
process.env.API_RATE_LIMIT_MAX = "250";
process.env.API_RATE_LIMIT_WINDOW = "1 minute";

const piiKeyMaterial = Buffer.alloc(32, 3).toString("base64");
const piiSaltMaterial = Buffer.alloc(32, 4).toString("base64");
process.env.PII_KEYS = JSON.stringify([{ kid: "test-pii", material: piiKeyMaterial }]);
process.env.PII_ACTIVE_KEY = "test-pii";
process.env.PII_SALTS = JSON.stringify([{ sid: "test-salt", secret: piiSaltMaterial }]);
process.env.PII_ACTIVE_SALT = "test-salt";

const kms = await createKeyManagementService();
const saltProvider = await createSaltProvider();
configurePIIProviders({
  kms,
  saltProvider,
  auditLogger: { record: async () => {} },
});

const signToken = async ({
  sub,
  orgId,
  roles,
  expiresIn = "1h",
}: {
  sub: string;
  orgId: string;
  roles: string[];
  expiresIn?: string;
}) =>
  new SignJWT({
    org: orgId,
    roles,
  })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid! })
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime(expiresIn)
    .setAudience(JWT_AUDIENCE)
    .setIssuer(JWT_ISSUER)
    .setSubject(sub)
    .sign(privateKey);

type OrgState = Org & { deletedAt: Date | null };

type AuditEntry = {
  id: string;
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

type IdempotencyRecord = {
  id: string;
  orgId: string;
  actorId: string;
  key: string;
  requestHash: string;
  responseHash: string;
  statusCode: number;
  responsePayload: unknown;
  resource: string | null;
  resourceId: string | null;
  createdAt: Date;
};

type State = {
  orgs: OrgState[];
  users: User[];
  bankLines: BankLine[];
  tombstones: Array<{ id: string; orgId: string; payload: AdminOrgExport; createdAt: Date }>;
  auditLogs: AuditEntry[];
  idempotencyEntries: IdempotencyRecord[];
};

type TransactionCallback<T> = (tx: PrismaLike) => Promise<T>;

type PrismaLike = Record<string, any>;

type Stub = {
  client: PrismaLike;
  state: State;
};

let app: FastifyInstance;
let stub: Stub;

beforeEach(async () => {
  stub = createPrismaStub();
  app = await createApp({ prisma: stub.client as any });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

test("admin export requires a valid admin token", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/admin/export/example-org",
  });
  assert.equal(response.statusCode, 401);
});

test("admin export rejects non-matching org access", async () => {
  const token = await signToken({
    sub: "admin-user",
    orgId: "org-abc",
    roles: ["admin"],
  });
  const response = await app.inject({
    method: "GET",
    url: "/admin/export/org-other",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 403);
});

test("admin export returns organisation data without secrets", async () => {
  seedOrgWithData(stub.state, {
    orgId: "org-123",
    userId: "user-456",
    lineId: "line-789",
  });

  const token = await signToken({
    sub: "admin-1",
    orgId: "org-123",
    roles: ["admin"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/admin/export/org-123",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { export: AdminOrgExport };
  assert.equal(body.export.bankLines[0]?.payee, "Vendor");
  assert.ok(stub.state.auditLogs.some((entry) => entry.action === "admin.org.export"));
});

test("GET /users requires an authenticated admin principal", async () => {
  const noAuth = await app.inject({ method: "GET", url: "/users" });
  assert.equal(noAuth.statusCode, 401);

  const token = await signToken({
    sub: "user-1",
    orgId: "org-123",
    roles: ["user"],
  });
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 403);
});

test("GET /users rejects expired tokens", async () => {
  const epoch = Math.floor(Date.now() / 1000);
  const expired = await new SignJWT({
    org: "org-expired",
    roles: ["admin"],
  })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid! })
    .setIssuedAt(epoch - 7200)
    .setNotBefore(epoch - 7200)
    .setExpirationTime(epoch - 3600)
    .setAudience(JWT_AUDIENCE)
    .setIssuer(JWT_ISSUER)
    .setSubject("expired-user")
    .sign(privateKey);

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${expired}` },
  });
  assert.equal(response.statusCode, 401);
});

test("GET /users scopes results to the caller's organisation and masks data", async () => {
  seedOrgWithData(stub.state, {
    orgId: "org-a",
    userId: "user-a",
    lineId: "line-a",
  });
  seedOrgWithData(stub.state, {
    orgId: "org-b",
    userId: "user-b",
    lineId: "line-b",
  });

  const token = await signToken({
    sub: "admin-1",
    orgId: "org-a",
    roles: ["admin"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { users: Array<{ userId: string; email: string }> };
  assert.equal(body.users.length, 1);
  assert.equal(body.users[0].userId, hashIdentifier("org-a:user-a"));
  assert.equal(body.users[0].email, "so*****@example.com");
  assert.ok(stub.state.auditLogs.some((entry) => entry.action === "users.list"));
});

test("GET /bank-lines requires an authenticated finance principal", async () => {
  const noAuth = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(noAuth.statusCode, 401);

  const forbiddenToken = await signToken({
    sub: "member-1",
    orgId: "org-a",
    roles: ["user"],
  });
  const forbidden = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${forbiddenToken}` },
  });
  assert.equal(forbidden.statusCode, 403);
});

test("GET /bank-lines only returns records for the caller's organisation", async () => {
  seedOrgWithData(stub.state, {
    orgId: "org-a",
    userId: "user-a",
    lineId: "line-a",
  });
  const altPayee = encryptPII("Different Vendor");
  const altDesc = encryptPII("Other org purchase");
  stub.state.bankLines.push({
    id: "line-b",
    orgId: "org-b",
    date: new Date("2024-03-01T00:00:00Z"),
    amount: 500 as any,
    payeeCiphertext: altPayee.ciphertext,
    payeeKid: altPayee.kid,
    descCiphertext: altDesc.ciphertext,
    descKid: altDesc.kid,
    createdAt: new Date("2024-03-02T00:00:00Z"),
  } as BankLine);

  const token = await signToken({
    sub: "finance-1",
    orgId: "org-a",
    roles: ["analyst"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { lines: Array<{ id: string; description: string }> };
  assert.equal(body.lines.length, 1);
  assert.equal(body.lines[0].id, hashIdentifier("line-a"));
  assert.equal(body.lines[0].description, "Invoice");
  assert.ok(stub.state.auditLogs.some((entry) => entry.action === "bank-lines.list"));
});

test("POST /bank-lines rejects mismatched claims", async () => {
  const token = await signToken({
    sub: "admin-1",
    orgId: "org-123",
    roles: ["admin"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      date: "2024-01-01T00:00:00.000Z",
      amount: "100.00",
      payee: "Acme",
      desc: "Test line",
      orgId: "org-other",
    } as any,
    headers: {
      authorization: `Bearer ${token}`,
      "Idempotency-Key": randomUUID(),
    },
  });

  assert.equal(response.statusCode, 400);
  const json = response.json() as { error: { code: string } };
  assert.equal(json.error.code, "invalid_body");
});

test("POST /bank-lines inserts a new line scoped to the principal", async () => {
  const token = await signToken({
    sub: "admin-1",
    orgId: "org-123",
    roles: ["admin"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      date: "2024-01-01T00:00:00.000Z",
      amount: "150.50",
      payee: "Acme",
      desc: "Consulting",
    },
    headers: { authorization: `Bearer ${token}`, "Idempotency-Key": randomUUID() },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json() as { line: { id: string; amount: number; description: string } };
  assert.equal(typeof body.line.id, "string");
  assert.equal(body.line.id.length, 16);
  assert.equal(body.line.amount, 150.5);
  assert.equal(body.line.description, "Consulting");
  assert.ok(stub.state.auditLogs.some((entry) => entry.action === "bank-lines.create"));
});

test("POST /bank-lines replays when Idempotency-Key is reused", async () => {
  const token = await signToken({
    sub: "admin-1",
    orgId: "org-123",
    roles: ["admin"],
  });

  const key = randomUUID();
  const payload = {
    date: "2024-01-01T00:00:00.000Z",
    amount: "250.00",
    payee: "Acme",
    desc: "Retainer",
  };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload,
    headers: { authorization: `Bearer ${token}`, "Idempotency-Key": key },
  });

  assert.equal(first.statusCode, 201);
  assert.equal(first.headers["idempotent-replay"], "false");

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload,
    headers: { authorization: `Bearer ${token}`, "Idempotency-Key": key },
  });

  assert.equal(second.statusCode, 201);
  assert.equal(second.headers["idempotent-replay"], "true");
  assert.deepEqual(second.json(), first.json());

  const createdLines = stub.state.bankLines.filter((line) => line.orgId === "org-123");
  assert.equal(createdLines.length, 1);

  const auditEvents = stub.state.auditLogs.filter((entry) => entry.action === "bank-lines.create");
  assert.equal(auditEvents.length, 1);
});

test("metrics endpoint exposes Prometheus counters", async () => {
  const response = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(response.statusCode, 200);
  assert.match(response.body as string, /http_requests_total/);
});

test("deleting an organisation requires matching admin role and audits the action", async () => {
  seedOrgWithData(stub.state, {
    orgId: "delete-me",
    userId: "delete-user",
    lineId: "delete-line",
  });

  const token = await signToken({
    sub: "admin-1",
    orgId: "delete-me",
    roles: ["admin"],
  });

  const response = await app.inject({
    method: "DELETE",
    url: "/admin/delete/delete-me",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { status: string; deletedAt: string };
  assert.equal(payload.status, "deleted");
  assert.ok(Date.parse(payload.deletedAt));

  assert.ok(stub.state.auditLogs.some((entry) => entry.action === "admin.org.delete"));
});

function createPrismaStub(initial?: Partial<State>): Stub {
  const state: State = {
    orgs: initial?.orgs ?? [],
    users: initial?.users ?? [],
    bankLines: initial?.bankLines ?? [],
    tombstones: initial?.tombstones ?? [],
    auditLogs: initial?.auditLogs ?? [],
    idempotencyEntries: initial?.idempotencyEntries ?? [],
  };

  const client: PrismaLike = {
    org: {
      findUnique: async (args: any) => {
        const { where, include } = args ?? {};
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
      update: async (args: any) => {
        const { where, data } = args ?? {};
        const org = state.orgs.find((o) => o.id === where.id);
        if (!org) throw new Error("Org not found");
        Object.assign(org, data);
        return { ...org } as Org;
      },
    },
    user: {
      findMany: async ({ select, orderBy, where }: any = {}) => {
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
      deleteMany: async (args: any) => {
        const { where } = args ?? {};
        const initialLength = state.users.length;
        state.users = state.users.filter((user) => user.orgId !== where?.orgId);
        return { count: initialLength - state.users.length };
      },
    },
    bankLine: {
      findMany: async ({ orderBy, take, where, select }: any = {}) => {
        let lines = [...state.bankLines];
        if (where?.orgId) {
          lines = lines.filter((line) => line.orgId === where.orgId);
        }
        if (orderBy?.date === "desc") {
          lines.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        if (typeof take === "number") {
          lines = lines.slice(0, take);
        }
        if (select) {
          return lines.map((line) => pick(line, select));
        }
        return lines;
      },
      create: async ({ data, select }: any) => {
        const created = {
          id: data.id ?? randomUUID(),
          orgId: data.orgId!,
          date: data.date as Date,
          amount: data.amount as any,
          payeeCiphertext: data.payeeCiphertext,
          payeeKid: data.payeeKid,
          descCiphertext: data.descCiphertext,
          descKid: data.descKid,
          createdAt: data.createdAt ?? new Date(),
          idempotencyKey: data.idempotencyKey ?? null,
        } as unknown as BankLine;
        state.bankLines.push(created);
        return select ? pick(created, select) : created;
      },
      createMany: async ({ data }: any) => {
        for (const entry of data) {
          const created = {
            id: entry.id ?? randomUUID(),
            orgId: entry.orgId,
            date: entry.date,
            amount: entry.amount,
            payeeCiphertext: entry.payeeCiphertext,
            payeeKid: entry.payeeKid,
            descCiphertext: entry.descCiphertext,
            descKid: entry.descKid,
            createdAt: entry.createdAt ?? new Date(),
            idempotencyKey: entry.idempotencyKey ?? null,
          } as unknown as BankLine;
          state.bankLines.push(created);
        }
        return { count: data.length };
      },
      deleteMany: async (args: any) => {
        const { where } = args ?? {};
        const initialLength = state.bankLines.length;
        state.bankLines = state.bankLines.filter((line) => line.orgId !== where?.orgId);
        return { count: initialLength - state.bankLines.length };
      },
      upsert: async ({ where, create, select }: any) => {
        const existing = state.bankLines.find(
          (line) =>
            line.orgId === where.orgId_idempotencyKey.orgId &&
            (line as any).idempotencyKey === where.orgId_idempotencyKey.idempotencyKey,
        );
        if (existing) {
          return select ? pick(existing, select) : existing;
        }
        const created = {
          id: create.id ?? randomUUID(),
          orgId: create.orgId,
          date: create.date,
          amount: create.amount,
          payeeCiphertext: create.payeeCiphertext,
          payeeKid: create.payeeKid,
          descCiphertext: create.descCiphertext,
          descKid: create.descKid,
          createdAt: create.createdAt ?? new Date(),
          idempotencyKey: create.idempotencyKey,
        } as any;
        state.bankLines.push(created);
        return select ? pick(created, select) : created;
      },
    },
    orgTombstone: {
      create: async (args: any) => {
        const { data } = args ?? {};
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
    auditLog: {
      create: async (args: any) => {
        const { data } = args ?? {};
        const entry: AuditEntry = {
          id: data.id ?? randomUUID(),
          orgId: data.orgId,
          actorId: data.actorId,
          action: data.action,
          metadata: (data.metadata ?? {}) as Record<string, unknown>,
          createdAt: data.createdAt ?? new Date(),
        };
        state.auditLogs.push(entry);
        return entry;
      },
    },
    idempotencyEntry: {
      findUnique: async ({ where }: any = {}) => {
        const composite = where?.orgId_key;
        if (!composite) return null;
        const entry = state.idempotencyEntries.find(
          (record) => record.orgId === composite.orgId && record.key === composite.key,
        );
        return entry ? { ...entry } : null;
      },
      create: async ({ data }: any = {}) => {
        const existing = state.idempotencyEntries.find(
          (record) => record.orgId === data.orgId && record.key === data.key,
        );
        if (existing) {
          const error: any = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const entry: IdempotencyRecord = {
          id: data.id ?? randomUUID(),
          orgId: data.orgId,
          actorId: data.actorId,
          key: data.key,
          requestHash: data.requestHash,
          responseHash: data.responseHash,
          statusCode: data.statusCode,
          responsePayload: data.responsePayload ?? null,
          resource: data.resource ?? null,
          resourceId: data.resourceId ?? null,
          createdAt: data.createdAt ?? new Date(),
        };
        state.idempotencyEntries.push(entry);
        return { ...entry };
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
    const payee = encryptPII("Vendor");
    const desc = encryptPII("Invoice");
    state.bankLines.push({
      id: ids.lineId,
      orgId: ids.orgId,
      date: new Date("2024-02-02T00:00:00Z"),
      amount: 1200 as any,
      payeeCiphertext: payee.ciphertext,
      payeeKid: payee.kid,
      descCiphertext: desc.ciphertext,
      descKid: desc.kid,
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
}
