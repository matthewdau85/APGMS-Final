import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data";
import { errorSchema } from "../schemas/common";

interface PrincipalLegacy {
  id: string;
  role: string;
  orgId: string;
  token: string;
}

type ParsedLegacyPrincipal = PrincipalLegacy | null;

type SecurityLogPayload = {
  event: "data_delete";
  orgId: string;
  principal: string;
  subjectUserId: string;
  mode: "anonymized" | "deleted";
};

export type { SecurityLogPayload };

const PASSWORD_PLACEHOLDER = "__deleted__";

type SharedDbModule = typeof import("../../../../shared/src/db.js");

type PrismaClientLike = Pick<
  SharedDbModule["prisma"],
  "user" | "bankLine"
>;

type AdminDataRouteDeps = {
  prisma?: PrismaClientLike;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
};

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {}
) {
  const prisma = deps.prisma ?? (await getDefaultPrisma());
  const securityLogger =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });

  app.post("/admin/data/delete", async (request, reply) => {
    const principal = parseLegacyAuthorization(request);
    if (!principal) {
      return sendError(reply, 401, "Unauthorized");
    }

    const bodyResult = adminDataDeleteRequestSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return sendValidationError(reply, bodyResult.error);
    }

    const body = bodyResult.data;

    if (principal.role !== "admin") {
      return sendError(reply, 403, "Forbidden");
    }

    if (principal.orgId !== body.orgId) {
      return sendError(reply, 403, "Forbidden");
    }

    const subject = await prisma.user.findFirst({
      where: { orgId: body.orgId, email: body.email },
    });

    if (!subject) {
      return sendError(reply, 404, "Not Found");
    }

    const hasConstraintRisk = await detectForeignKeyRisk(
      prisma,
      subject.id,
      subject.email,
      subject.orgId
    );

    const occurredAt = new Date().toISOString();
    let response = adminDataDeleteResponseSchema.parse({
      action: "deleted" as const,
      userId: subject.id,
      occurredAt,
    });

    if (hasConstraintRisk) {
      const anonymizedEmail = anonymizeEmail(subject.email, subject.id);
      await prisma.user.update({
        where: { id: subject.id },
        data: {
          email: anonymizedEmail,
          password: PASSWORD_PLACEHOLDER,
        },
      });

      response = adminDataDeleteResponseSchema.parse({
        action: "anonymized",
        userId: subject.id,
        occurredAt,
      });
    } else {
      await prisma.user.delete({ where: { id: subject.id } });
    }

    await securityLogger({
      event: "data_delete",
      orgId: body.orgId,
      principal: principal.id,
      subjectUserId: subject.id,
      mode: response.action,
    });

    return reply.code(202).send(response);
  });
}

const principalSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  role: z.enum(["admin", "user"]),
  email: z.string().email(),
});

type Principal = z.infer<typeof principalSchema>;

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
};

type SecLogFn = (payload: {
  event: string;
  orgId: string;
  principal: string;
  subjectEmail: string;
}) => void;

const adminDataRoutes: FastifyPluginAsync = async (app) => {
  const db: DbClient | undefined = (app as any).db;
  if (!db) {
    throw new Error("database client not registered");
  }

  const log: SecLogFn =
    (app as any).secLog ??
    ((entry) => {
      app.log.info({ event: entry.event, ...entry }, "security_event");
    });

  app.post("/admin/data/export", async (req, reply) => {
    const bodyResult = subjectDataExportRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendValidationError(reply, bodyResult.error);
    }

    const body = bodyResult.data;

    const principal = parsePrincipal(req);
    if (!principal) {
      return sendError(reply, 401, "Unauthorized");
    }

    if (principal.role !== "admin") {
      return sendError(reply, 403, "Forbidden");
    }

    if (principal.orgId !== body.orgId) {
      return sendError(reply, 403, "Forbidden");
    }

    const userRecord = await db.user.findFirst({
      where: { email: body.email, orgId: body.orgId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        org: { select: { id: true, name: true } },
      },
    });

    if (!userRecord) {
      return sendError(reply, 404, "Not Found");
    }

    const bankLinesCount = await db.bankLine.count({
      where: { orgId: body.orgId },
    });

    const exportedAt = new Date().toISOString();

    if (db.accessLog?.create) {
      await db.accessLog.create({
        data: {
          event: "data_export",
          orgId: body.orgId,
          principalId: principal.id,
          subjectEmail: body.email,
        },
      });
    }

    log({
      event: "data_export",
      orgId: body.orgId,
      principal: principal.id,
      subjectEmail: body.email,
    });

    const responsePayload = subjectDataExportResponseSchema.parse({
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
    });

    return reply.send(responsePayload);
  });
};

export default adminDataRoutes;

function parseLegacyAuthorization(request: FastifyRequest): ParsedLegacyPrincipal {
  const header =
    request.headers["authorization"] ??
    request.headers["Authorization" as keyof typeof request.headers];
  if (!header || typeof header !== "string") {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return null;
  }

  const token = match[1];
  const [role, principalId, orgId] = token.split(":");
  if (!role || !principalId || !orgId) {
    return null;
  }

  return {
    id: principalId,
    role,
    orgId,
    token,
  };
}

function parsePrincipal(req: FastifyRequest): Principal | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return principalSchema.parse(parsed);
  } catch {
    return null;
  }
}

async function detectForeignKeyRisk(
  prisma: PrismaClientLike,
  userId: string,
  email: string,
  orgId: string
): Promise<boolean> {
  const relatedLines = await prisma.bankLine.count({
    where: {
      orgId,
      payee: email,
    },
  });

  if (relatedLines > 0) {
    return true;
  }

  const otherRefs = await prisma.bankLine.count({
    where: {
      orgId,
      desc: {
        contains: userId,
      },
    },
  });

  return otherRefs > 0;
}

function anonymizeEmail(email: string, userId: string): string {
  const hash = createHash("sha256").update(`${email}:${userId}`).digest("hex");
  return `deleted+${hash.slice(0, 12)}@example.com`;
}

let cachedDefaultPrisma: PrismaClientLike | null = null;

async function getDefaultPrisma(): Promise<PrismaClientLike> {
  if (!cachedDefaultPrisma) {
    const module = (await import("../../../../shared/src/db.js")) as SharedDbModule;
    cachedDefaultPrisma = module.prisma;
  }
  return cachedDefaultPrisma;
}

function sendValidationError(reply: FastifyReply, error: z.ZodError<unknown>) {
  return sendError(reply, 400, "Bad Request", error.flatten());
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  details?: unknown
) {
  const payload = errorSchema.parse(
    details ? { error: message, details } : { error: message }
  );
  return reply.code(statusCode).send(payload);
}
