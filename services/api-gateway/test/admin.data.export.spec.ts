import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import adminDataRoutes from "../src/routes/admin.data";
import { subjectDataExportResponseSchema } from "../src/schemas/admin.data";

type DbOverrides = {
  userFindFirst?: DbClient["user"]["findFirst"];
  bankLineCount?: DbClient["bankLine"]["count"];
  accessLogCreate?: NonNullable<DbClient["accessLog"]>["create"];
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

const ADMIN_TOKEN = "admin-token";
const ADMIN_PRINCIPAL_ID = "admin-1";

process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.ADMIN_PRINCIPAL_ID = ADMIN_PRINCIPAL_ID;

const buildToken = () => `Bearer ${ADMIN_TOKEN}`;

const buildApp = async (
  db: DbClient,
  secLog: (entry: {
    event: string;
    orgId: string;
    principal: string;
    subjectEmail: string;
  }) => void = () => {}
) => {
  const app = Fastify();
  app.decorate("db", db);
  app.decorate("secLog", secLog);
  await app.register(adminDataRoutes);
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

test("401 when token does not match admin token", async () => {
  const app = await buildApp(buildTestDb());
  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { orgId: "org-123", email: "subject@example.com" },
    headers: {
      authorization: "Bearer wrong-token",
    },
  });
  assert.equal(response.statusCode, 401);
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
      authorization: buildToken(),
    },
  });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test("200 returns expected export bundle", async () => {
  const accessLogCalls: unknown[] = [];
  const secLogCalls: unknown[] = [];
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
    }
  );

  const response = await app.inject({
    method: "POST",
    url: "/admin/data/export",
    payload: { orgId: "org-123", email: "subject@example.com" },
    headers: {
      authorization: buildToken(),
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
      principalId: ADMIN_PRINCIPAL_ID,
      subjectEmail: "subject@example.com",
    },
  });
  assert.equal(secLogCalls.length, 1);
  assert.deepEqual(secLogCalls[0], {
    event: "data_export",
    orgId: "org-123",
    principal: ADMIN_PRINCIPAL_ID,
    subjectEmail: "subject@example.com",
  });

  await app.close();
});
