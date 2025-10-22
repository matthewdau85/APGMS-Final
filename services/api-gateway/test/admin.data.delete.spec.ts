import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createHmac } from "node:crypto";

import cors from "@fastify/cors";
import Fastify from "fastify";

import { __resetAdminAuthConfigForTests } from "../src/config";
import {
  registerAdminDataRoutes,
  type SecurityLogPayload,
} from "../src/routes/admin.data";
import { adminDataDeleteResponseSchema } from "../src/schemas/admin.data";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.SHADOW_DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test-shadow";

type PrismaUser = {
  id: string;
  email: string;
  password: string | null;
  createdAt: Date;
  orgId: string;
};

const TEST_ISSUER = "https://issuer.test";
const TEST_AUDIENCE = "apgms-admin";
const TEST_SECRET = "test-secret";

describe("POST /admin/data/delete", () => {
  let app: ReturnType<typeof Fastify>;
  const prismaStub = {
    user: {
      findFirst: async () => null as PrismaUser | null,
      update: async (_args: any) => null as PrismaUser | null,
      delete: async (_args: any) => null as PrismaUser | null,
    },
    bankLine: {
      count: async (_args: any) => 0,
    },
  };
  let securityLogs: SecurityLogPayload[] = [];
  let signingKey: Buffer;

  const buildBearerToken = async (
    role: string,
    orgId: string,
    principalId = "principal",
    options: {
      email?: string;
      issuer?: string;
      audience?: string;
      expiresAt?: number;
      secret?: Buffer;
      extraClaims?: Record<string, unknown>;
    } = {}
  ) => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = {
      role,
      orgId,
      email: options.email ?? "admin@example.com",
      sub: principalId,
      iss: options.issuer ?? TEST_ISSUER,
      aud: options.audience ?? TEST_AUDIENCE,
      iat: issuedAt,
      exp: options.expiresAt ?? issuedAt + 300,
      ...(options.extraClaims ?? {}),
    };
    const header = { alg: "HS256", typ: "JWT" };
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode(header)}.${encode(payload)}`;
    const signature = createHmac("sha256", options.secret ?? signingKey)
      .update(unsigned)
      .digest("base64url");
    return `Bearer ${unsigned}.${signature}`;
  };

  const defaultPayload = {
    orgId: "org-123",
    email: "user@example.com",
    confirm: "DELETE",
  } as const;

  beforeEach(async () => {
    process.env.ADMIN_JWT_ISSUER = TEST_ISSUER;
    process.env.ADMIN_JWT_AUDIENCE = TEST_AUDIENCE;
    process.env.ADMIN_JWT_ALGORITHM = "HS256";
    process.env.ADMIN_JWT_SECRET = TEST_SECRET;
    __resetAdminAuthConfigForTests();

    signingKey = Buffer.from(TEST_SECRET, "utf8");
    app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    securityLogs = [];

    prismaStub.user.findFirst = async () => null;
    prismaStub.user.update = async () => null;
    prismaStub.user.delete = async () => null;
    prismaStub.bankLine.count = async () => 0;

    await registerAdminDataRoutes(app, {
      prisma: prismaStub as any,
      secLog: async (payload) => {
        securityLogs.push(payload);
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 without bearer token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
    });

    assert.equal(response.statusCode, 401);
  });

  it("rejects expired tokens", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
      headers: {
        authorization: await buildBearerToken("admin", defaultPayload.orgId, "admin-1", {
          expiresAt: Math.floor(Date.now() / 1000) - 10,
        }),
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(securityLogs.length, 0);
  });

  it("rejects tokens signed with the wrong key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
      headers: {
        authorization: await buildBearerToken("admin", defaultPayload.orgId, "admin-1", {
          secret: Buffer.from("not-the-secret", "utf8"),
        }),
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(securityLogs.length, 0);
  });

  it("rejects non-admin principals", async () => {
    let findCalled = false;
    prismaStub.user.findFirst = (async (...args: any[]) => {
      findCalled = true;
      return null;
    }) as typeof prismaStub.user.findFirst;

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
      headers: {
        authorization: await buildBearerToken("member", defaultPayload.orgId),
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(findCalled, false);
  });

  it("validates confirm token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: { ...defaultPayload, confirm: "nope" },
      headers: {
        authorization: await buildBearerToken("admin", defaultPayload.orgId),
      },
    });

    assert.equal(response.statusCode, 400);
  });

  it("returns 404 for unknown subject", async () => {
    prismaStub.user.findFirst = async () => null;

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
      headers: {
        authorization: await buildBearerToken("admin", defaultPayload.orgId),
      },
    });

    assert.equal(response.statusCode, 404);
  });

  it("anonymizes user with constraint risk", async () => {
    const user: PrismaUser = {
      id: "user-1",
      email: defaultPayload.email,
      password: "secret",
      createdAt: new Date(),
      orgId: defaultPayload.orgId,
    };

    let findCalls = 0;
    prismaStub.user.findFirst = async () => {
      findCalls += 1;
      return user;
    };

    const countCalls: any[] = [];
    prismaStub.bankLine.count = async (args: any) => {
      countCalls.push(args);
      if (countCalls.length === 1) {
        return 1;
      }
      return 0;
    };

    const updateCalls: any[] = [];
    prismaStub.user.update = async (args: any) => {
      updateCalls.push(args);
      return { ...user, email: "deleted" };
    };

    let deleteCalled = false;
    prismaStub.user.delete = async () => {
      deleteCalled = true;
      return user;
    };

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
      headers: {
        authorization: await buildBearerToken("admin", defaultPayload.orgId, "admin-1"),
      },
    });

    assert.equal(response.statusCode, 202);
    const body = response.json();
    assert.doesNotThrow(() => adminDataDeleteResponseSchema.parse(body));
    assert.equal(body.action, "anonymized");
    assert.equal(body.userId, user.id);
    assert.equal(typeof body.occurredAt, "string");

    assert.equal(findCalls, 1);
    assert.equal(countCalls.length, 1);
    assert.equal(countCalls[0].where.payee, user.email);
    assert.equal(deleteCalled, false);
    assert.equal(updateCalls.length, 1);
    const updateArgs = updateCalls[0];
    assert.match(updateArgs.data.email, /^deleted\+[a-f0-9]{12}@example.com$/);
    assert.equal(updateArgs.data.password, "__deleted__");

    const lastLog = securityLogs.at(-1);
    assert.deepEqual(lastLog, {
      event: "data_delete",
      orgId: defaultPayload.orgId,
      principal: "admin-1",
      subjectUserId: user.id,
      mode: "anonymized",
    });
  });

  it("hard deletes user when no constraint risk", async () => {
    const user: PrismaUser = {
      id: "user-2",
      email: defaultPayload.email,
      password: "secret",
      createdAt: new Date(),
      orgId: defaultPayload.orgId,
    };

    prismaStub.user.findFirst = async () => user;
    prismaStub.bankLine.count = async () => 0;

    let updateCalled = false;
    prismaStub.user.update = async (args: any) => {
      updateCalled = true;
      return { ...user, email: args.data.email };
    };

    let deleteArgs: any = null;
    prismaStub.user.delete = async (args: any) => {
      deleteArgs = args;
      return user;
    };

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
      headers: {
        authorization: await buildBearerToken("admin", defaultPayload.orgId),
      },
    });

    assert.equal(response.statusCode, 202);
    const body = response.json();
    assert.doesNotThrow(() => adminDataDeleteResponseSchema.parse(body));
    assert.equal(body.action, "deleted");
    assert.equal(body.userId, user.id);

    assert.equal(updateCalled, false);
    assert.deepEqual(deleteArgs, { where: { id: user.id } });

    const lastLog = securityLogs.at(-1);
    assert.deepEqual(lastLog, {
      event: "data_delete",
      orgId: defaultPayload.orgId,
      principal: "principal",
      subjectUserId: user.id,
      mode: "deleted",
    });
  });
});
