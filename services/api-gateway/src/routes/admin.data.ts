import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data";
import { hashPassword } from "@apgms/shared";

const PASSWORD_PLACEHOLDER = "__deleted__";
const LEGACY_BEARER = /^Bearer\s+(.+)$/i;

interface LegacyPrincipal {
  id: string;
  role: string;
  orgId: string;
}

export interface SecurityLogPayload {
  event: "data_delete" | "data_export";
  orgId: string;
  principal: string;
  subjectUserId?: string;
  subjectEmail?: string;
  mode?: "anonymized" | "deleted";
}

type SharedDbModule = typeof import("../../../../shared/src/db.js");

type PrismaClientLike = Pick<
  SharedDbModule["prisma"],
  "user" | "bankLine" | "org" | "orgTombstone" | "auditLog"
>;

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
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
  const secLog =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });
  const auditLogger =
    deps.auditLog ??
    (prisma.auditLog && prisma.auditLog.create
      ? async (payload: SecurityLogPayload & { occurredAt: string }) => {
          await prisma.auditLog.create({
            data: {
              orgId: payload.orgId,
              actorId: payload.principal,
              action: payload.event,
              metadata: {
                ...(payload.subjectUserId ? { subjectUserId: payload.subjectUserId } : {}),
                ...(payload.subjectEmail ? { subjectEmail: payload.subjectEmail } : {}),
                ...(payload.mode ? { mode: payload.mode } : {}),
              },
              createdAt: new Date(payload.occurredAt),
            },
          });
        }
      : undefined);
  const hash = deps.hash ?? hashPassword;
  const recordSecurityEvent = async (payload: SecurityLogPayload) => {
    await secLog(payload);
    if (app.metrics) {
      app.metrics.recordSecurityEvent(payload.event);
    }
  };


  app.post("/admin/data/delete", async (req, reply) => {
    const principal = parseLegacyPrincipal(req);
    if (!principal) {
      app.metrics?.recordSecurityEvent("auth.unauthorized");
      void reply.code(401).send({ error: "unauthorized" });
      return;
    }
    if (principal.role !== "admin") {
      app.metrics?.recordSecurityEvent("auth.forbidden");
      void reply.code(403).send({ error: "forbidden" });
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

      await recordSecurityEvent({
        event: "data_delete",
        orgId: payload.orgId,
        principal: principal.id,
        subjectUserId: targetUser.id,
        mode: "anonymized",
      });
      if (auditLogger) {
        await auditLogger({
          event: "data_delete",
          orgId: payload.orgId,
          principal: principal.id,
          subjectUserId: targetUser.id,
          mode: "anonymized",
          occurredAt,
        });
      }

      const response = {
        action: "anonymized" as const,
        userId: targetUser.id,
        occurredAt,
      };
      void reply.code(202).send(response);
      return;
    }

    await prisma.user.delete({ where: { id: targetUser.id } });
    await recordSecurityEvent({
      event: "data_delete",
      orgId: payload.orgId,
      principal: principal.id,
      subjectUserId: targetUser.id,
      mode: "deleted",
    });
    if (auditLogger) {
      await auditLogger({
        event: "data_delete",
        orgId: payload.orgId,
        principal: principal.id,
        subjectUserId: targetUser.id,
        mode: "deleted",
        occurredAt,
      });
    }
    const response = {
      action: "deleted" as const,
      userId: targetUser.id,
      occurredAt,
    };
    void reply.code(202).send(response);
  });
}

const principalSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  role: z.enum(["admin", "user"]),
  email: z.string().email(),
});

type ExportPrincipal = z.infer<typeof principalSchema>;

const adminDataRoutes: FastifyPluginAsync = async (app) => {
  const db = (app as unknown as { db?: unknown }).db as
    | {
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
        accessLog?: {
          create: (args: {
            data: { event: string; orgId: string; principalId: string; subjectEmail: string };
          }) => Promise<unknown>;
        };
      }
    | undefined;

  if (!db) {
    throw new Error("admin data export routes require app.db to be decorated");
  }

  const secLog = (app as unknown as { secLog?: (payload: SecurityLogPayload) => void }).secLog;

  app.post("/admin/data/export", async (request, reply) => {
    const principal = parseExportPrincipal(request);
    if (!principal) {
      app.metrics?.recordSecurityEvent("auth.unauthorized");
      void reply.code(401).send({ error: "unauthorized" });
      return;
    }
    if (principal.role !== "admin") {
      app.metrics?.recordSecurityEvent("auth.forbidden");
      void reply.code(403).send({ error: "forbidden" });
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
    await recordSecurityEvent({
      event: "data_export",
      orgId: payload.orgId,
      principal: principal.id,
      subjectEmail: payload.email,
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

function parseLegacyPrincipal(req: FastifyRequest): LegacyPrincipal | null {
  const header =
    req.headers.authorization ??
    req.headers["Authorization" as keyof typeof req.headers];
  const value = Array.isArray(header) ? header?.[0] : header;
  if (!value) {
    return null;
  }
  const match = LEGACY_BEARER.exec(value.trim());
  if (!match) {
    return null;
  }
  const token = match[1];
  const [role, id, orgId] = token.split(":");
  if (!role || !id || !orgId) {
    return null;
  }
  return { role, id, orgId };
}

function parseExportPrincipal(req: FastifyRequest): ExportPrincipal | null {
  const header =
    req.headers.authorization ??
    req.headers["Authorization" as keyof typeof req.headers];
  const value = Array.isArray(header) ? header?.[0] : header;
  if (!value) {
    return null;
  }
  const match = LEGACY_BEARER.exec(value.trim());
  if (!match) {
    return null;
  }
  try {
    const decoded = Buffer.from(match[1], "base64url").toString("utf8");
    return principalSchema.parse(JSON.parse(decoded));
  } catch {
    return null;
  }
}

function anonymizeEmail(email: string, userId: string): string {
  const hash = createHash("sha256").update(`${email}:${userId}`).digest("hex");
  return `deleted+${hash.slice(0, 12)}@example.com`;
}

