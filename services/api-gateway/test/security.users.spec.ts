import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";

import { buildServer } from "../src/app";
import { prisma } from "../src/db";

type UserRecord = {
  id: string;
  orgId: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: Date;
};

const SECRET = process.env.AUTH_DEV_SECRET!;
const AUDIENCE = process.env.AUTH_AUDIENCE!;
const ISSUER = process.env.AUTH_ISSUER!;

function signToken(
  overrides: Partial<jwt.JwtPayload & { role: string; orgId: string; mfaEnabled: boolean }> = {},
): string {
  const payload: jwt.JwtPayload = {
    sub: "admin-user",
    orgId: "org-123",
    role: "admin",
    mfaEnabled: true,
    ...overrides,
  };

  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: "5m",
  });
}

describe("GET /security/users", () => {
  let app: FastifyInstance;
  let originalFindMany: typeof prisma.user.findMany;
  let originalAuditFindFirst: typeof prisma.auditLog.findFirst;
  let originalAuditCreate: typeof prisma.auditLog.create;

  const createdAt = new Date("2024-01-01T00:00:00Z");
  const records: UserRecord[] = [
    {
      id: "user-1",
      orgId: "org-123",
      email: "someone@example.com",
      role: "analyst",
      mfaEnabled: false,
      createdAt,
    },
    {
      id: "user-2",
      orgId: "org-123",
      email: "aa@example.com",
      role: "admin",
      mfaEnabled: true,
      createdAt,
    },
  ];

  before(async () => {
    originalFindMany = prisma.user.findMany;
    originalAuditFindFirst = prisma.auditLog.findFirst;
    originalAuditCreate = prisma.auditLog.create;

    prisma.user.findMany = (async (args: any = {}) => {
      const orgId = args?.where?.orgId;
      let users = [...records];
      if (orgId) {
        users = users.filter((user) => user.orgId === orgId);
      }
      const select = args?.select;
      if (!select) {
        return users;
      }
      return users.map((user) => {
        const entry: Record<string, unknown> = {};
        for (const [field, include] of Object.entries(select)) {
          if (!include) continue;
          entry[field] = (user as any)[field];
        }
        return entry;
      });
    }) as typeof prisma.user.findMany;

    prisma.auditLog.findFirst = (async () => null) as typeof prisma.auditLog.findFirst;
    prisma.auditLog.create = (async () => ({} as any)) as typeof prisma.auditLog.create;

    app = await buildServer();
    await app.ready();
  });

  after(async () => {
    prisma.user.findMany = originalFindMany;
    prisma.auditLog.findFirst = originalAuditFindFirst;
    prisma.auditLog.create = originalAuditCreate;
    await app.close();
  });

  it("requires authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/security/users" });
    assert.equal(response.statusCode, 401);
  });

  it("rejects non-admin principals", async () => {
    const token = signToken({ role: "analyst" });
    const response = await app.inject({
      method: "GET",
      url: "/security/users",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 403);
  });

  it("masks user emails for authorised administrators", async () => {
    const token = signToken();
    const response = await app.inject({
      method: "GET",
      url: "/security/users",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      users: Array<{ id: string; email: string; role: string; mfaEnabled: boolean; createdAt: string; lastLogin: string }>;
    };
    assert.equal(body.users.length, 2);

    const first = body.users.find((user) => user.id === "user-1");
    assert.ok(first, "expected first user record");
    assert.equal(first!.email, "so*@example.com");
    assert.equal(first!.lastLogin, createdAt.toISOString());

    for (const user of body.users) {
      const original = records.find((record) => record.id === user.id);
      assert.ok(original, `missing fixture for ${user.id}`);
      assert.notEqual(user.email, original!.email);
    }
  });
});
