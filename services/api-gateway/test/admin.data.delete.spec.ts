import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import cors from "@fastify/cors";
import Fastify from "fastify";

import {
  registerAdminDataRoutes,
  type AdminPrincipal,
  type SecurityLogPayload,
} from "../src/routes/admin.data";
import type { AppendOnlyAuditLogEntry } from "@apgms/shared/audit-log";
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
  const auditLogEntries: AppendOnlyAuditLogEntry[] = [];
  let securityLogs: SecurityLogPayload[] = [];

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    securityLogs = [];

    prismaStub.user.findFirst = async () => null;
    prismaStub.user.update = async () => null;
    prismaStub.user.delete = async () => null;
    prismaStub.bankLine.count = async () => 0;

    auditLogEntries.length = 0;

    await registerAdminDataRoutes(app, {
      prisma: prismaStub as any,
      secLog: async (payload) => {
        securityLogs.push(payload);
      },
      auth: {
        verify: async (request) =>
          parseToken(request.headers.authorization as string | undefined),
      },
      auditLog: {
        append: async (entry: AppendOnlyAuditLogEntry) => {
          auditLogEntries.push(entry);
        },
      } as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const parseToken = (header?: string): AdminPrincipal | null => {
    if (!header) {
      return null;
    }
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      return null;
    }
    const [role, principalId, orgId] = match[1].split(":");
    if (!role || !principalId || !orgId) {
      return null;
    }
    if (role !== "admin" && role !== "user") {
      return null;
    }
    return {
      id: principalId,
      role,
      orgId,
      email: `${principalId}@example.com`,
    } satisfies AdminPrincipal;
  };

  const buildToken = (role: string, orgId: string, principalId = "principal") =>
    `Bearer ${role}:${principalId}:${orgId}`;

  const defaultPayload = {
    orgId: "org-123",
    email: "user@example.com",
    confirm: "DELETE",
  } as const;

  it("returns 401 without bearer token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/admin/data/delete",
      payload: defaultPayload,
    });

    assert.equal(response.statusCode, 401);
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
        authorization: buildToken("user", defaultPayload.orgId),
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
        authorization: buildToken("admin", defaultPayload.orgId),
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
        authorization: buildToken("admin", defaultPayload.orgId),
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
        authorization: buildToken("admin", defaultPayload.orgId, "admin-1"),
      },
    });

    assert.equal(response.statusCode, 202);
    const body = response.json();
    assert.doesNotThrow(() => adminDataDeleteResponseSchema.parse(body));
    assert.equal(body.action, "anonymized");
    assert.equal(body.userId, user.id);
    assert.equal(typeof body.occurredAt, "string");
    assert.ok(Date.parse(body.occurredAt));

    assert.equal(findCalls, 1);
    assert.equal(countCalls.length, 1);
    assert.equal(countCalls[0].where.payee, user.email);
    assert.equal(deleteCalled, false);
    assert.equal(updateCalls.length, 1);
    const updateArgs = updateCalls[0];
    assert.match(updateArgs.data.email, /^deleted\+[a-f0-9]{12}@example.com$/);
    assert.equal(updateArgs.data.password, "__deleted__");

    const lastLog = securityLogs[securityLogs.length - 1];
    assert.equal(lastLog?.event, "data_delete");
    assert.equal(lastLog?.orgId, defaultPayload.orgId);
    assert.equal(lastLog?.principal, "admin-1");
    assert.equal(lastLog?.subjectUserId, user.id);
    assert.equal(lastLog?.mode, "anonymized");
    assert.ok(lastLog?.occurredAt && Date.parse(lastLog.occurredAt));
    assert.equal(auditLogEntries.length, 1);
    assert.equal(auditLogEntries[0].event, "data_delete");
    assert.equal(auditLogEntries[0].orgId, defaultPayload.orgId);
    assert.equal(auditLogEntries[0].principalId, "admin-1");
    assert.equal(auditLogEntries[0].payload.subjectUserId, user.id);
    assert.equal(auditLogEntries[0].payload.mode, "anonymized");
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
        authorization: buildToken("admin", defaultPayload.orgId),
      },
    });

    assert.equal(response.statusCode, 202);
    const body = response.json();
    assert.doesNotThrow(() => adminDataDeleteResponseSchema.parse(body));
    assert.equal(body.action, "deleted");
    assert.equal(body.userId, user.id);

    assert.equal(updateCalled, false);
    assert.deepEqual(deleteArgs, { where: { id: user.id } });

    const lastLog = securityLogs[securityLogs.length - 1];
    assert.equal(lastLog?.event, "data_delete");
    assert.equal(lastLog?.orgId, defaultPayload.orgId);
    assert.equal(lastLog?.principal, "principal");
    assert.equal(lastLog?.subjectUserId, user.id);
    assert.equal(lastLog?.mode, "deleted");
    assert.ok(lastLog?.occurredAt && Date.parse(lastLog.occurredAt));
    assert.equal(auditLogEntries.length >= 1, true);
    const auditTail = auditLogEntries[auditLogEntries.length - 1];
    assert.equal(auditTail?.event, "data_delete");
    assert.equal(auditTail?.orgId, defaultPayload.orgId);
    assert.equal(auditTail?.payload.subjectUserId, user.id);
    assert.equal(auditTail?.payload.mode, "deleted");
  });
});
