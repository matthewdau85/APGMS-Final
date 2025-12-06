import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import adminDataRoutes from "../src/routes/admin.data";
import { subjectDataExportResponseSchema } from "../src/schemas/admin.data";
const buildTestDb = (overrides = {}) => ({
    user: {
        findFirst: overrides.userFindFirst ??
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
const buildApp = async (db, authenticate, secLog = () => { }) => {
    const app = Fastify();
    app.decorate("db", db);
    app.decorate("secLog", secLog);
    app.decorate("adminDataAuth", authenticate);
    await app.register(adminDataRoutes);
    await app.ready();
    return app;
};
test("401 without token", async () => {
    const app = await buildApp(buildTestDb(), async (_req, reply) => {
        void reply.code(401).send({ error: "unauthorized" });
        return null;
    });
    const response = await app.inject({
        method: "POST",
        url: "/admin/data/export",
        payload: { orgId: "org-123", email: "subject@example.com" },
    });
    assert.equal(response.statusCode, 401);
    await app.close();
});
test("403 when principal is not admin", async () => {
    const app = await buildApp(buildTestDb(), async (_req, reply) => {
        void reply.code(403).send({ error: "forbidden" });
        return null;
    });
    const response = await app.inject({
        method: "POST",
        url: "/admin/data/export",
        payload: { orgId: "org-123", email: "subject@example.com" },
    });
    assert.equal(response.statusCode, 403);
    await app.close();
});
test("404 when subject is missing", async () => {
    const app = await buildApp(buildTestDb({
        userFindFirst: async () => null,
    }), async (_req, _reply, _roles) => ({
        id: "admin-1",
        orgId: "org-123",
        roles: ["admin"],
        token: "token",
    }));
    const response = await app.inject({
        method: "POST",
        url: "/admin/data/export",
        payload: { orgId: "org-123", email: "missing@example.com" },
    });
    assert.equal(response.statusCode, 404);
    await app.close();
});
test("200 returns expected export bundle", async () => {
    const accessLogCalls = [];
    const secLogCalls = [];
    const app = await buildApp(buildTestDb({
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
    }), async (_req, _reply, _roles) => ({
        id: "admin-1",
        orgId: "org-123",
        roles: ["admin"],
        token: "token",
    }), (entry) => {
        secLogCalls.push(entry);
    });
    const response = await app.inject({
        method: "POST",
        url: "/admin/data/export",
        payload: { orgId: "org-123", email: "subject@example.com" },
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
    assert.deepEqual(secLogCalls[0], {
        event: "data_export",
        orgId: "org-123",
        principal: "admin-1",
        subjectEmail: "subject@example.com",
    });
    await app.close();
});
