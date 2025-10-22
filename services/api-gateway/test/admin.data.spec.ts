import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import cors from "@fastify/cors";
import Fastify from "fastify";

import { type AuditLogEntry } from "@apgms/shared";
import {
  registerAdminDataRoutes,
  type SecurityLogPayload,
} from "../src/routes/admin.data";
import {
  adminDataDeleteResponseSchema,
  subjectDataExportResponseSchema,
} from "../src/schemas/admin.data";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.SHADOW_DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test-shadow";

type PrismaUser = {
  id: string;
  email: string;
  password: string | null;
  createdAt: Date;
  orgId: string;
  org?: { id: string; name: string };
};

describe("admin data routes", () => {
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
    accessLog: {
      create: async (_args: any) => ({} as unknown),
    },
  };
  let securityLogs: SecurityLogPayload[] = [];
  let auditEntries: AuditLogEntry[] = [];
  const fixedNow = new Date("2024-01-02T03:04:05.000Z");

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    securityLogs = [];
    auditEntries = [];

    prismaStub.user.findFirst = async () => null;
    prismaStub.user.update = async () => null;
    prismaStub.user.delete = async () => null;
    prismaStub.bankLine.count = async () => 0;

    await registerAdminDataRoutes(app, {
      prisma: prismaStub as any,
      secLog: async (payload) => {
        securityLogs.push(payload);
      },
      auditLog: {
        write: async (entry) => {
          auditEntries.push(entry);
        },
      },
      now: () => fixedNow,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const buildToken = (role: string, orgId: string, principalId = "principal") =>
    `Bearer ${role}:${principalId}:${orgId}`;

  describe("POST /admin/data/delete", () => {
    const defaultPayload = {
      orgId: "org-123",
      email: "user@example.com",
      confirm: "DELETE",
    } as const;

    it("records audit entry alongside security log", async () => {
      const user: PrismaUser = {
        id: "user-1",
        email: defaultPayload.email,
        password: "secret",
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
        orgId: defaultPayload.orgId,
      };

      prismaStub.user.findFirst = async () => user;
      prismaStub.bankLine.count = async () => 0;
      prismaStub.user.delete = async () => user;

      const response = await app.inject({
        method: "POST",
        url: "/admin/data/delete",
        payload: defaultPayload,
        headers: {
          authorization: buildToken("admin", defaultPayload.orgId, "admin-99"),
        },
      });

      assert.equal(response.statusCode, 202);
      const body = response.json();
      assert.doesNotThrow(() => adminDataDeleteResponseSchema.parse(body));
      assert.equal(securityLogs.length, 1);
      assert.deepEqual(securityLogs[0], {
        event: "data_delete",
        orgId: defaultPayload.orgId,
        principal: "admin-99",
        subjectUserId: user.id,
        mode: "deleted",
      });
      assert.equal(auditEntries.length, 1);
      assert.deepEqual(auditEntries[0], {
        principal: "admin-99",
        action: "admin.data.delete",
        scope: "org:org-123:user:user-1",
        timestamp: fixedNow.toISOString(),
        metadata: { mode: "deleted" },
      });
    });
  });

  describe("POST /admin/data/export", () => {
    const defaultPayload = {
      orgId: "org-999",
      email: "subject@example.com",
    } as const;

    it("masks sensitive fields and records audit entry", async () => {
      const user: PrismaUser = {
        id: "user-2",
        email: defaultPayload.email,
        password: "secret",
        createdAt: new Date("2021-05-06T07:08:09.000Z"),
        orgId: defaultPayload.orgId,
        org: { id: defaultPayload.orgId, name: "Sensitive Org" },
      };

      prismaStub.user.findFirst = async () => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        org: user.org!,
      });
      prismaStub.bankLine.count = async () => 4;

      const response = await app.inject({
        method: "POST",
        url: "/admin/data/export",
        payload: defaultPayload,
        headers: {
          authorization: buildToken("admin", defaultPayload.orgId, "admin-55"),
        },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json();
      const parsed = subjectDataExportResponseSchema.parse(body);
      assert.equal(parsed.user.id, user.id);
      assert.equal(parsed.org.id, defaultPayload.orgId);
      assert.equal(parsed.relationships.bankLinesCount, 4);
      assert.match(parsed.user.email, /^sux+@ex+\.com$/i);
      assert.match(parsed.org.name, /^S\*+g$/);
      assert.equal(parsed.exportedAt, fixedNow.toISOString());

      assert.equal(auditEntries.length, 1);
      assert.deepEqual(auditEntries[0], {
        principal: "admin-55",
        action: "admin.data.export",
        scope: "org:org-999:user:user-2",
        timestamp: fixedNow.toISOString(),
      });
    });
  });
});
