import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerAdminDataRoutes, } from "../src/routes/admin.data";
import { adminDataDeleteResponseSchema } from "../src/schemas/admin.data";
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.SHADOW_DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test-shadow";
describe("POST /admin/data/delete", () => {
    let app;
    const prismaStub = {
        user: {
            findFirst: async () => null,
            update: async (_args) => null,
            delete: async (_args) => null,
        },
        bankLine: {
            count: async (_args) => 0,
        },
    };
    let securityLogs = [];
    let authenticateImpl;
    beforeEach(async () => {
        app = Fastify({ logger: false });
        await app.register(cors, { origin: true });
        securityLogs = [];
        authenticateImpl = async (_req, _reply, _roles) => ({
            id: "principal",
            orgId: defaultPayload.orgId,
            roles: ["admin"],
            token: "token",
        });
        prismaStub.user.findFirst = async () => null;
        prismaStub.user.update = async () => null;
        prismaStub.user.delete = async () => null;
        prismaStub.bankLine.count = async () => 0;
        await registerAdminDataRoutes(app, {
            prisma: prismaStub,
            authenticate: async (req, reply, roles) => authenticateImpl(req, reply, roles),
            secLog: async (payload) => {
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
    };
    it("returns 401 without bearer token", async () => {
        authenticateImpl = async (_req, reply, _roles) => {
            void reply.code(401).send({ error: "unauthorized" });
            return null;
        };
        const response = await app.inject({
            method: "POST",
            url: "/admin/data/delete",
            payload: defaultPayload,
        });
        assert.equal(response.statusCode, 401);
    });
    it("rejects non-admin principals", async () => {
        authenticateImpl = async (_req, reply, _roles) => {
            void reply.code(403).send({ error: "forbidden" });
            return null;
        };
        let findCalled = false;
        prismaStub.user.findFirst = (async (...args) => {
            findCalled = true;
            return null;
        });
        const response = await app.inject({
            method: "POST",
            url: "/admin/data/delete",
            payload: defaultPayload,
        });
        assert.equal(response.statusCode, 403);
        assert.equal(findCalled, false);
    });
    it("validates confirm token", async () => {
        authenticateImpl = async (_req, _reply, _roles) => ({
            id: "principal",
            orgId: defaultPayload.orgId,
            roles: ["admin"],
            token: "token",
        });
        const response = await app.inject({
            method: "POST",
            url: "/admin/data/delete",
            payload: { ...defaultPayload, confirm: "nope" },
        });
        assert.equal(response.statusCode, 400);
    });
    it("returns 404 for unknown subject", async () => {
        authenticateImpl = async (_req, _reply, _roles) => ({
            id: "principal",
            orgId: defaultPayload.orgId,
            roles: ["admin"],
            token: "token",
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
        authenticateImpl = async (_req, _reply, _roles) => ({
            id: "admin-1",
            orgId: defaultPayload.orgId,
            roles: ["admin"],
            token: "token",
        });
        const user = {
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
        const countCalls = [];
        prismaStub.bankLine.count = async (args) => {
            countCalls.push(args);
            if (countCalls.length === 1) {
                return 1;
            }
            return 0;
        };
        const updateCalls = [];
        prismaStub.user.update = async (args) => {
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
        assert.equal(body.retentionDays, 365);
        assert.equal(findCalls, 1);
        assert.equal(countCalls.length, 1);
        assert.deepEqual(countCalls[0].where, { orgId: defaultPayload.orgId });
        assert.equal(deleteCalled, false);
        assert.equal(updateCalls.length, 1);
        const updateArgs = updateCalls[0];
        assert.match(updateArgs.data.email, /^deleted\+\d+d-[a-f0-9]{12}@example.com$/);
        assert.match(updateArgs.data.password, /^\$argon2id\$/);
        const lastLog = securityLogs[securityLogs.length - 1] ?? null;
        assert.deepEqual(lastLog, {
            event: "data_delete",
            orgId: defaultPayload.orgId,
            principal: "admin-1",
            subjectUserId: user.id,
            mode: "anonymized",
            retentionDays: 365,
        });
    });
    it("anonymizes user within retention window when no constraint risk", async () => {
        const user = {
            id: "user-2",
            email: defaultPayload.email,
            password: "secret",
            createdAt: new Date(),
            orgId: defaultPayload.orgId,
        };
        prismaStub.user.findFirst = async () => user;
        prismaStub.bankLine.count = async () => 0;
        let updateCalled = false;
        prismaStub.user.update = async (args) => {
            updateCalled = true;
            return { ...user, email: args.data.email };
        };
        let deleteArgs = null;
        prismaStub.user.delete = async (args) => {
            deleteArgs = args;
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
        assert.equal(body.retentionDays, 365);
        assert.equal(updateCalled, true);
        assert.equal(deleteArgs, null);
        const lastLog = securityLogs[securityLogs.length - 1] ?? null;
        assert.deepEqual(lastLog, {
            event: "data_delete",
            orgId: defaultPayload.orgId,
            principal: "principal",
            subjectUserId: user.id,
            mode: "anonymized",
            retentionDays: 365,
        });
    });
    it("hard deletes user when retention window has elapsed", async () => {
        const user = {
            id: "user-3",
            email: defaultPayload.email,
            password: "secret",
            createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
            orgId: defaultPayload.orgId,
        };
        prismaStub.user.findFirst = async () => user;
        prismaStub.bankLine.count = async () => 0;
        let updateCalled = false;
        prismaStub.user.update = async () => {
            updateCalled = true;
            return user;
        };
        let deleteArgs = null;
        prismaStub.user.delete = async (args) => {
            deleteArgs = args;
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
        assert.equal(body.action, "deleted");
        assert.equal(body.userId, user.id);
        assert.equal(body.retentionDays, 365);
        assert.equal(updateCalled, false);
        assert.deepEqual(deleteArgs, { where: { id: user.id } });
        const lastLog = securityLogs[securityLogs.length - 1] ?? null;
        assert.deepEqual(lastLog, {
            event: "data_delete",
            orgId: defaultPayload.orgId,
            principal: "principal",
            subjectUserId: user.id,
            mode: "deleted",
            retentionDays: 365,
        });
    });
});
