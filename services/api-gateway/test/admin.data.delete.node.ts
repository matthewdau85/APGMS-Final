import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import cors from "@fastify/cors";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import {
  registerAdminDataRoutes,
  type SecurityLogEntry,
} from "../src/routes/admin.data";
import { adminDataDeleteResponseSchema } from "../src/schemas/admin.data";
import type { Principal } from "../src/lib/auth";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.SHADOW_DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test-shadow";

type PrismaUser = {
  id: string;
  email: string;
  password: string | null;
  createdAt: Date;
  orgId: string;
};

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
  let securityLogs: SecurityLogEntry[] = [];
  let authenticateImpl: AuthenticateFn;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    securityLogs = [];
    authenticateImpl = async (
      _req: FastifyRequest,
      _reply: FastifyReply,
      _roles: ReadonlyArray<string>,
    ) => ({
      id: "principal",
      orgId: defaultPayload.orgId,
      roles: ["admin"],
      token: "token",
      mfaEnabled: true,
    });

    prismaStub.user.findFirst = async () => null;
    prismaStub.user.update = async () => null;
    prismaStub.user.delete = async () => null;
    prismaStub.bankLine.count = async () => 0;

    await registerAdminDataRoutes(app, {
      prisma: prismaStub as any,
      authenticate: async (
        req: FastifyRequest,
        reply: FastifyReply,
        roles: ReadonlyArray<string>,
      ) => authenticateImpl(req, reply, roles),
      secLog: async (payload: SecurityLogEntry) => {
        securityLogs.push(payload);
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const defaultPayload = {
    orgId: "org-123",
    email: "user@example.com",
    confirm: "DELETE",
  } as const;

  it("returns 401 without bearer token", async () => {
    authenticateImpl = async (
      _req: FastifyRequest,
      reply: FastifyReply,
      _roles: ReadonlyArray<string>,
    ) => {
      void reply.code(401).send({ error: "unauthorized" });
      return null;
    };

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      headers: { "x-correlation-id": "delete-anonymized" },
      payload: defaultPayload,
    });

    assert.equal(response.statusCode, 401);
  });

  it("rejects non-admin principals", async () => {
    authenticateImpl = async (
      _req: FastifyRequest,
      reply: FastifyReply,
      _roles: ReadonlyArray<string>,
    ) => {
      void reply.code(403).send({ error: "forbidden" });
      return null;
    };

    let findCalled = false;
    prismaStub.user.findFirst = (async (...args: any[]) => {
      findCalled = true;
      return null;
    }) as typeof prismaStub.user.findFirst;

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
    });

    assert.equal(response.statusCode, 403);
    assert.equal(findCalled, false);
  });

  it("validates confirm token", async () => {
    authenticateImpl = async (
      _req: FastifyRequest,
      _reply: FastifyReply,
      _roles: ReadonlyArray<string>,
    ) => ({
      id: "principal",
      orgId: defaultPayload.orgId,
      roles: ["admin"],
      token: "token",
      mfaEnabled: true,
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: { ...defaultPayload, confirm: "nope" },
    });

    assert.equal(response.statusCode, 400);
  });

  it("returns 404 for unknown subject", async () => {
    authenticateImpl = async (
      _req: FastifyRequest,
      _reply: FastifyReply,
      _roles: ReadonlyArray<string>,
    ) => ({
      id: "principal",
      orgId: defaultPayload.orgId,
      roles: ["admin"],
      token: "token",
      mfaEnabled: true,
    });

    prismaStub.user.findFirst = async () => null;

    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
    });

    assert.equal(response.statusCode, 404);
  });

  it("anonymizes user with constraint risk", async () => {
    authenticateImpl = async (
      _req: FastifyRequest,
      _reply: FastifyReply,
      _roles: ReadonlyArray<string>,
    ) => ({
      id: "admin-1",
      orgId: defaultPayload.orgId,
      roles: ["admin"],
      token: "token",
      mfaEnabled: true,
    });

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
    });

    assert.equal(response.statusCode, 202);
    const body = response.json();
    assert.doesNotThrow(() => adminDataDeleteResponseSchema.parse(body));
    assert.equal(body.action, "anonymized");
    assert.equal(body.userId, user.id);
    assert.equal(typeof body.occurredAt, "string");

    assert.equal(findCalls, 1);
    assert.equal(countCalls.length, 1);
    assert.deepEqual(countCalls[0].where, { orgId: defaultPayload.orgId });
    assert.equal(deleteCalled, false);
    assert.equal(updateCalls.length, 1);
    const updateArgs = updateCalls[0];
    assert.match(updateArgs.data.email, /^deleted\+[a-f0-9]{12}@example.com$/);
    assert.match(updateArgs.data.password, /^\$argon2id\$/);

    const logEntry = securityLogs[securityLogs.length - 1];
    assert.equal(logEntry?.event, "data_delete");
    assert.equal(logEntry?.mode, "anonymized");
    assert.equal(logEntry?.orgId, defaultPayload.orgId);
    assert.equal(logEntry?.principal, "admin-1");
    assert.equal(logEntry?.subjectUserId, user.id);
    assert.equal(logEntry?.subjectEmail, "[REDACTED:EMAIL]");
    if (logEntry?.correlationId) {
      assert.equal(logEntry.correlationId, "delete-anonymized");
    }
    assert.ok(logEntry?.occurredAt);
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
      headers: { "x-correlation-id": "delete-hard" },
      payload: defaultPayload,
    });

    assert.equal(response.statusCode, 202);
    const body = response.json();
    assert.doesNotThrow(() => adminDataDeleteResponseSchema.parse(body));
    assert.equal(body.action, "deleted");
    assert.equal(body.userId, user.id);

    assert.equal(updateCalled, false);
    assert.deepEqual(deleteArgs, { where: { id: user.id } });

    const logEntry = securityLogs[securityLogs.length - 1];
    assert.equal(logEntry?.event, "data_delete");
    assert.equal(logEntry?.mode, "deleted");
    assert.equal(logEntry?.subjectUserId, user.id);
    assert.equal(logEntry?.subjectEmail, "[REDACTED:EMAIL]");
    if (logEntry?.correlationId) {
      assert.equal(logEntry.correlationId, "delete-hard");
    }
    assert.ok(logEntry?.occurredAt);
  });
});

type AuthenticateFn = (
  req: FastifyRequest,
  reply: FastifyReply,
  roles: ReadonlyArray<string>,
) => Promise<Principal | null>;
