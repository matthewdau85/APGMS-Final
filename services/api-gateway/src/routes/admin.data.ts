import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
  type AdminDataDeleteRequest,
  type AdminDataDeleteResponse,
  type SubjectDataExportRequest,
  type SubjectDataExportResponse,
} from "../schemas/admin.data";

interface Principal {
  id: string;
  role: "admin" | "user";
  orgId: string;
  email?: string;
  token: string;
}

type SecurityLogPayload =
  | {
      event: "data_delete";
      orgId: string;
      principal: string;
      subjectUserId: string;
      mode: "anonymized" | "deleted";
    }
  | {
      event: "data_export";
      orgId: string;
      principal: string;
      subjectEmail: string;
    };

const PASSWORD_PLACEHOLDER = "__deleted__";

type SharedDbModule = typeof import("../../../../shared/src/db.js");
type PrismaClientLike =
  Pick<SharedDbModule["prisma"], "user" | "bankLine"> &
  Partial<Pick<SharedDbModule["prisma"], "accessLog">>;

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {}
) {
  const prisma = deps.prisma ?? (await getDefaultPrisma());
  const securityLogger: (payload: SecurityLogPayload) => Promise<void> | void =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });

  app.post("/admin/data/delete", async (request, reply) => {
    const principal = parseAuthorization(request);
    if (!principal) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (principal.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }

    const parsed = adminDataDeleteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;

    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const subject = await prisma.user.findFirst({
      where: { orgId: body.orgId, email: body.email },
    });

    if (!subject) {
      return reply.code(404).send({ error: "not_found" });
    }

    const hasConstraintRisk = await detectForeignKeyRisk(
      prisma,
      subject.id,
      subject.email,
      subject.orgId
    );

    const occurredAt = new Date().toISOString();
    let response: AdminDataDeleteResponse;

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
      response = adminDataDeleteResponseSchema.parse({
        action: "deleted",
        userId: subject.id,
        occurredAt,
      });
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

  app.post("/admin/data/export", async (request, reply) => {
    const principal = parseAuthorization(request);
    if (!principal) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (principal.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }

    const bodyResult = subjectDataExportRequestSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = bodyResult.data;

    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const userRecord = await prisma.user.findFirst({
      where: { email: body.email, orgId: body.orgId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        org: { select: { id: true, name: true } },
      },
    });

    if (!userRecord) {
      return reply.code(404).send({ error: "not_found" });
    }

    const bankLinesCount = await prisma.bankLine.count({
      where: { orgId: body.orgId },
    });

    const exportedAt = new Date().toISOString();

    if (prisma.accessLog?.create) {
      await prisma.accessLog.create({
        data: {
          event: "data_export",
          orgId: body.orgId,
          principalId: principal.id,
          subjectEmail: body.email,
        },
      });
    }

    await securityLogger({
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

    return reply.send(responsePayload satisfies SubjectDataExportResponse);
  });
}

const principalSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  role: z.enum(["admin", "user"]),
  email: z.string().email().optional(),
});

function parseAuthorization(request: FastifyRequest): Principal | null {
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

  const decoded = tryDecodePrincipal(token);
  if (!decoded) {
    return null;
  }

  return { ...decoded, token } satisfies Principal;
}

function tryDecodePrincipal(token: string): Omit<Principal, "token"> | null {
  const jsonDecoded = tryParseJsonPrincipal(token);
  if (jsonDecoded) {
    return jsonDecoded;
  }

  const colonDecoded = tryParseColonPrincipal(token);
  if (colonDecoded) {
    return colonDecoded;
  }

  return null;
}

function tryParseJsonPrincipal(token: string): Omit<Principal, "token"> | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    const validated = principalSchema.parse(parsed);
    return validated;
  } catch {
    return null;
  }
}

function tryParseColonPrincipal(token: string): Omit<Principal, "token"> | null {
  const [role, id, orgId] = token.split(":");
  if (!role || !id || !orgId) {
    return null;
  }

  try {
    return principalSchema.parse({ role, id, orgId });
  } catch {
    return null;
  }
}

async function detectForeignKeyRisk(
  prisma: Pick<PrismaClientLike, "bankLine">,
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

export type {
  AdminDataDeleteRequest,
  AdminDataDeleteResponse,
  SubjectDataExportRequest,
  SubjectDataExportResponse,
  SecurityLogPayload,
};

export const adminDataRoutes: FastifyPluginAsync = async (app) => {
  await registerAdminDataRoutes(app);
};

export default adminDataRoutes;
