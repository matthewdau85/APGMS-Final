import { createHash } from "node:crypto";
import { adminDataDeleteRequestSchema, subjectDataExportRequestSchema, subjectDataExportResponseSchema, } from "../schemas/admin.data";
import { hashPassword } from "@apgms/shared";
import { authenticateRequest, } from "../lib/auth";
const PASSWORD_PLACEHOLDER = "__deleted__";
async function buildDefaultPrisma() {
    const module = (await import("../../../../shared/src/db.js"));
    return module.prisma;
}
export async function registerAdminDataRoutes(app, deps = {}) {
    const prisma = deps.prisma ?? (await buildDefaultPrisma());
    const authenticate = deps.authenticate ?? ((req, reply, roles) => authenticateRequest(app, req, reply, roles));
    const secLog = deps.secLog ??
        (async (payload) => {
            app.log.info({ security: payload }, "security_event");
        });
    const hash = deps.hash ?? hashPassword;
    const logAuditEvent = async (payload) => {
        if (deps.auditLog) {
            await deps.auditLog(payload);
            return;
        }
        if (prisma.auditLog && typeof prisma.auditLog.create === "function") {
            await prisma.auditLog.create({
                data: {
                    orgId: payload.orgId,
                    actorId: payload.principal,
                    action: payload.event,
                    metadata: buildAuditMetadata(payload),
                    createdAt: new Date(payload.occurredAt),
                },
            });
        }
    };
    app.post("/admin/data/delete", async (req, reply) => {
        const principal = await authenticate(req, reply, ["admin"]);
        if (!principal) {
            return;
        }
        const parsed = adminDataDeleteRequestSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            void reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
            return;
        }
        const payload = parsed.data;
        if (payload.orgId !== principal.orgId) {
            app.metrics?.recordSecurityEvent("auth.forbidden");
            void reply.code(403).send({ error: "forbidden" });
            return;
        }
        const targetUser = await prisma.user.findFirst({
            where: { email: payload.email, orgId: payload.orgId },
        });
        if (!targetUser) {
            void reply.code(404).send({ error: "user_not_found" });
            return;
        }
        const referencedLines = await prisma.bankLine.count({
            where: { orgId: payload.orgId },
        });
        const occurredAt = new Date().toISOString();
        if (referencedLines > 0) {
            const anonymizedEmail = anonymizeEmail(targetUser.email, targetUser.id);
            const hashedPlaceholder = await hash(PASSWORD_PLACEHOLDER);
            await prisma.user.update({
                where: { id: targetUser.id },
                data: {
                    email: anonymizedEmail,
                    password: hashedPlaceholder,
                },
            });
            if (secLog) {
                await secLog({
                    event: "data_delete",
                    orgId: payload.orgId,
                    principal: principal.id,
                    subjectUserId: targetUser.id,
                    mode: "anonymized",
                });
            }
            app.metrics?.recordSecurityEvent("data_delete");
            await logAuditEvent({
                event: "data_delete",
                orgId: payload.orgId,
                principal: principal.id,
                subjectUserId: targetUser.id,
                mode: "anonymized",
                occurredAt,
            });
            const response = {
                action: "anonymized",
                userId: targetUser.id,
                occurredAt,
            };
            void reply.code(202).send(response);
            return;
        }
        await prisma.user.delete({ where: { id: targetUser.id } });
        if (secLog) {
            await secLog({
                event: "data_delete",
                orgId: payload.orgId,
                principal: principal.id,
                subjectUserId: targetUser.id,
                mode: "deleted",
            });
        }
        app.metrics?.recordSecurityEvent("data_delete");
        await logAuditEvent({
            event: "data_delete",
            orgId: payload.orgId,
            principal: principal.id,
            subjectUserId: targetUser.id,
            mode: "deleted",
            occurredAt,
        });
        const response = {
            action: "deleted",
            userId: targetUser.id,
            occurredAt,
        };
        void reply.code(202).send(response);
    });
}
const adminDataRoutes = async (app) => {
    const db = app.db;
    if (!db) {
        throw new Error("admin data export routes require app.db to be decorated");
    }
    const authenticate = app.adminDataAuth ??
        ((req, reply, roles) => authenticateRequest(app, req, reply, roles));
    const secLog = app.secLog;
    const auditLog = app.auditLog;
    app.post("/admin/data/export", async (request, reply) => {
        const principal = await authenticate(request, reply, ["admin"]);
        if (!principal) {
            return;
        }
        const payloadParse = subjectDataExportRequestSchema.safeParse(request.body ?? {});
        if (!payloadParse.success) {
            void reply.code(400).send({ error: "invalid_request", details: payloadParse.error.flatten() });
            return;
        }
        const payload = payloadParse.data;
        if (payload.orgId !== principal.orgId) {
            app.metrics?.recordSecurityEvent("auth.forbidden");
            void reply.code(403).send({ error: "forbidden" });
            return;
        }
        const userRecord = await db.user.findFirst({
            where: { email: payload.email, orgId: payload.orgId },
            select: {
                id: true,
                email: true,
                createdAt: true,
                org: { select: { id: true, name: true } },
            },
        });
        if (!userRecord) {
            void reply.code(404).send({ error: "user_not_found" });
            return;
        }
        const bankLinesCount = await db.bankLine.count({ where: { orgId: payload.orgId } });
        const exportedAt = new Date().toISOString();
        if (db.accessLog?.create) {
            await db.accessLog.create({
                data: {
                    event: "data_export",
                    orgId: payload.orgId,
                    principalId: principal.id,
                    subjectEmail: payload.email,
                },
            });
        }
        if (secLog) {
            await secLog({
                event: "data_export",
                orgId: payload.orgId,
                principal: principal.id,
                subjectEmail: payload.email,
            });
        }
        app.metrics?.recordSecurityEvent("data_export");
        await logAuditForDb(db, auditLog, {
            event: "data_export",
            orgId: payload.orgId,
            principal: principal.id,
            subjectEmail: payload.email,
            occurredAt: exportedAt,
        });
        const responsePayload = {
            org: {
                id: userRecord.org.id,
                name: userRecord.org.name,
            },
            user: {
                id: userRecord.id,
                email: userRecord.email,
                createdAt: userRecord.createdAt.toISOString(),
            },
            relationships: {
                bankLinesCount,
            },
            exportedAt,
        };
        const validated = subjectDataExportResponseSchema.parse(responsePayload);
        void reply.send(validated);
    });
};
export default adminDataRoutes;
function anonymizeEmail(email, userId) {
    const hash = createHash("sha256").update(`${email}:${userId}`).digest("hex");
    return `deleted+${hash.slice(0, 12)}@example.com`;
}
function buildAuditMetadata(payload) {
    return {
        ...(payload.subjectUserId ? { subjectUserId: payload.subjectUserId } : {}),
        ...(payload.subjectEmail ? { subjectEmail: payload.subjectEmail } : {}),
        ...(payload.mode ? { mode: payload.mode } : {}),
    };
}
async function logAuditForDb(db, auditLogFn, payload) {
    if (auditLogFn) {
        await auditLogFn(payload);
        return;
    }
    if (db?.auditLog && typeof db.auditLog.create === "function") {
        await db.auditLog.create({
            data: {
                orgId: payload.orgId,
                actorId: payload.principal,
                action: payload.event,
                metadata: buildAuditMetadata(payload),
                createdAt: new Date(payload.occurredAt),
            },
        });
    }
}
