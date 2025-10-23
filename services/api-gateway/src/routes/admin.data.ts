import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data";
import { hashPassword } from "@apgms/shared";
import {
  AuthError,
  requireRole,
  verifyRequest,
  type Principal,
} from "../lib/auth";

const PASSWORD_PLACEHOLDER = "__deleted__";

export interface SecurityLogPayload {
  event: "data_delete" | "data_export";
  orgId: string;
  principal: string;
  subjectUserId?: string;
  subjectEmail?: string;
  mode?: "anonymized" | "deleted";
}

type Role = Parameters<typeof requireRole>[1][number];

type SharedDbModule = typeof import("../../../../shared/src/db.js");

type PrismaClientLike = Pick<
  SharedDbModule["prisma"],
  "user" | "bankLine" | "org" | "orgTombstone" | "auditLog"
>;

type AuthenticateFn = (
  req: FastifyRequest,
  reply: FastifyReply,
  roles: ReadonlyArray<Role>,
) => Promise<Principal | null>;

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  authenticate?: AuthenticateFn;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
  auditLog?: (payload: SecurityLogPayload & { occurredAt: string }) => Promise<void> | void;
  hash?: (password: string) => Promise<string>;
}

async function buildDefaultPrisma(): Promise<PrismaClientLike> {
  const module = (await import("../../../../shared/src/db.js")) as SharedDbModule;
  return module.prisma;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {},
): Promise<void> {
  const prisma = deps.prisma ?? (await buildDefaultPrisma());
  const authenticate = deps.authenticate ?? createDefaultAuthenticator(app);
  const secLog =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });
  const hash = deps.hash ?? hashPassword;

  const logAuditEvent = async (payload: SecurityLogPayload & { occurredAt: string }) => {
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
        action: "anonymized" as const,
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
      action: "deleted" as const,
      userId: targetUser.id,
      occurredAt,
    };
    void reply.code(202).send(response);
  });
}

const adminDataRoutes: FastifyPluginAsync = async (app) => {
  const db = (app as unknown as { db?: unknown }).db as
    | (PrismaClientLike & {
        accessLog?: {
          create: (args: {
            data: {
              event: string;
              orgId: string;
              principalId: string;
              subjectEmail: string;
            };
          }) => Promise<unknown>;
        };
      })
    | undefined;

  if (!db) {
    throw new Error("admin data export routes require app.db to be decorated");
  }

  const authenticate =
    (app as unknown as { adminDataAuth?: AuthenticateFn }).adminDataAuth ??
    createDefaultAuthenticator(app);
  const secLog = (app as unknown as { secLog?: (payload: SecurityLogPayload) => void }).secLog;
  const auditLog = (app as unknown as {
    auditLog?: (payload: SecurityLogPayload & { occurredAt: string }) => Promise<void> | void;
  }).auditLog;

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

function anonymizeEmail(email: string, userId: string): string {
  const hash = createHash("sha256").update(`${email}:${userId}`).digest("hex");
  return `deleted+${hash.slice(0, 12)}@example.com`;
}

function buildAuditMetadata(payload: SecurityLogPayload) {
  return {
    ...(payload.subjectUserId ? { subjectUserId: payload.subjectUserId } : {}),
    ...(payload.subjectEmail ? { subjectEmail: payload.subjectEmail } : {}),
    ...(payload.mode ? { mode: payload.mode } : {}),
  };
}

function createDefaultAuthenticator(app: FastifyInstance): AuthenticateFn {
  return async (req, reply, roles) => {
    try {
      const principal = await verifyRequest(req, reply);
      requireRole(principal, roles);
      app.metrics?.recordSecurityEvent("auth.success");
      return principal;
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.statusCode === 403) {
          app.metrics?.recordSecurityEvent("auth.forbidden");
        } else {
          app.metrics?.recordSecurityEvent("auth.unauthorized");
        }
        const errorCode = error.code ?? "unauthorized";
        void reply.code(error.statusCode).send({ error: errorCode });
        return null;
      }
      throw error;
    }
  };
}

async function logAuditForDb(
  db: PrismaClientLike | undefined,
  auditLogFn: ((payload: SecurityLogPayload & { occurredAt: string }) => Promise<void> | void) | undefined,
  payload: SecurityLogPayload & { occurredAt: string },
): Promise<void> {
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
