import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAdminDataRoutes, type AdminPrincipal } from "../src/routes/admin.data";
import { subjectDataExportResponseSchema } from "../src/schemas/admin.data";
import type { AppendOnlyAuditLogEntry } from "@apgms/shared/audit-log";

type DbOverrides = {
  userFindFirst?: DbClient["user"]["findFirst"];
  bankLineCount?: DbClient["bankLine"]["count"];
  accessLogCreate?: NonNullable<DbClient["accessLog"]>["create"];
};

type AuditLogStub = {
  append: (entry: AppendOnlyAuditLogEntry) => Promise<void>;
};

type DbClient = {
  user: {
    findFirst: (args: {
      where: { email: string; orgId: string };
      select: {
        id: true;
        email: true;
        createdAt: true;
        org: { select: { id: true; name: true } };
      };
    }) => Promise<
      | {
          id: string;
          email: string;
          createdAt: Date;
          org: { id: string; name: string };
        }
      | null
    >;
  };
  bankLine: {
    count: (args: { where: { orgId: string } }) => Promise<number>;
  };
  accessLog: {
    create: (args: {
      data: {
        event: string;
        orgId: string;
        principalId: string;
        subjectEmail: string;
      };
    }) => Promise<unknown>;
  };
};

const buildTestDb = (overrides: DbOverrides = {}): DbClient => ({
  user: {
    findFirst:
      overrides.userFindFirst ??
      (async () => ({
        id: "user-1",
        email: "subject@example.com",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        org: { id: "org-123", name: "Example Org" },
      })),
  },
  bankLine: {
    count: overrides.bankLineCount ?? (async () => 0),
  },
  accessLog: {
    create: overrides.accessLogCreate ?? (async () => ({})),
  },
});

const buildToken = (principal: {
  id: string;
  orgId: string;
  role: "admin" | "user";
  email: string;
}) => `Bearer ${Buffer.from(JSON.stringify(principal)).toString("base64url")}`;

const parseToken = (header?: string): AdminPrincipal | null => {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object") {
      return null;
    }
    if (typeof decoded.id !== "string" || typeof decoded.orgId !== "string") {
      return null;
    }
    if (decoded.role !== "admin" && decoded.role !== "user") {
      return null;
    }
    if (typeof decoded.email !== "string") {
      return null;
    }
    return decoded as AdminPrincipal;
  } catch {
    return null;
  }
};

const buildApp = async (
  db: DbClient,
  secLog: (entry: {
    event: string;
    orgId: string;
    principal: string;
    subjectEmail: string;
    occurredAt: string;
  }) => void = () => {},
  auditLog: AuditLogStub = { append: async () => {} }
) => {
  const app = Fastify();
  app.decorate("db", db);
  app.decorate("secLog", secLog);
  await registerAdminDataRoutes(app, {
    prisma: db as unknown as any,
    auth: {
      verify: async (request) => parseToken(request.headers.authorization as string | undefined),
    },
    secLog: secLog as any,
    accessLog: db.accessLog,
    auditLog: auditLog as any,
  });
  await app.ready();
  return app;
};

test("401 without token", async () => {
  const app = await buildApp(buildTestDb());
  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { orgId: "org-123", email: "subject@example.com" },
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("403 when principal is not admin", async () => {
  const app = await buildApp(buildTestDb());
  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { orgId: "org-123", email: "subject@example.com" },
    headers: {
      authorization: buildToken({
        id: "user-1",
        orgId: "org-123",
        role: "user",
        email: "user@example.com",
      }),
    },
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("404 when subject is missing", async () => {
  const app = await buildApp(
    buildTestDb({
      userFindFirst: async () => null,
    })
  );
  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { orgId: "org-123", email: "missing@example.com" },
    headers: {
      authorization: buildToken({
        id: "admin-1",
        orgId: "org-123",
        role: "admin",
        email: "admin@example.com",
      }),
    },
  });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test("200 returns expected export bundle", async () => {
  const accessLogCalls: Array<{ data: Record<string, unknown> }> = [];
  const secLogCalls: Array<{
    event: string;
    orgId: string;
    principal: string;
    subjectEmail: string;
    occurredAt: string;
  }> = [];
  const auditLogCalls: AppendOnlyAuditLogEntry[] = [];
  const app = await buildApp(
    buildTestDb({
      bankLineCount: async () => 5,
      userFindFirst: async () => ({
        id: "user-99",
        email: "subject@example.com",
        createdAt: new Date("2022-05-05T00:00:00.000Z"),
        org: { id: "org-123", name: "Example Org" },
      }),
      accessLogCreate: async (args) => {
        accessLogCalls.push(args);
        return {};
      },
    }),
    (entry) => {
      secLogCalls.push(entry);
    },
    {
      append: async (entry) => {
        auditLogCalls.push(entry);
      },
    }
  );

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { orgId: "org-123", email: "subject@example.com" },
    headers: {
      authorization: buildToken({
        id: "admin-1",
        orgId: "org-123",
        role: "admin",
        email: "admin@example.com",
      }),
    },
  });

  assert.equal(response.statusCode, 200);
  const json = response.json();
  const parsed = subjectDataExportResponseSchema.parse(json);
  assert.equal(parsed.org.id, "org-123");
  assert.equal(parsed.user.id, "user-99");
  assert.equal(parsed.relationships.bankLinesCount, 5);
  assert.ok(Date.parse(parsed.user.createdAt));
  assert.ok(Date.parse(parsed.exportedAt));
  assert.equal(accessLogCalls.length, 1);
  assert.deepEqual(accessLogCalls[0], {
    data: {
      event: "data_export",
      orgId: "org-123",
      principalId: "admin-1",
      subjectEmail: "subject@example.com",
    },
  });
  assert.equal(secLogCalls.length, 1);
  assert.equal(secLogCalls[0].event, "data_export");
  assert.equal(secLogCalls[0].orgId, "org-123");
  assert.equal(secLogCalls[0].principal, "admin-1");
  assert.equal(secLogCalls[0].subjectEmail, "subject@example.com");
  assert.equal(typeof secLogCalls[0].occurredAt, "string");
  assert.ok(Date.parse(secLogCalls[0].occurredAt));
  assert.equal(auditLogCalls.length, 1);
  assert.equal(auditLogCalls[0].event, "data_export");
  assert.equal(auditLogCalls[0].orgId, "org-123");
  assert.equal(auditLogCalls[0].principalId, "admin-1");
  assert.equal(auditLogCalls[0].payload.subjectEmail, "subject@example.com");
  assert.equal(auditLogCalls[0].payload.bankLinesCount, 5);

  await app.close();
});
