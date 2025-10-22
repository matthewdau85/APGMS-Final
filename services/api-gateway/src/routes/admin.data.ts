import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

import { createAuditLogWriter, type AuditLogWriter } from "@apgms/shared";
import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
  type AdminDataDeleteRequest,
  type AdminDataDeleteResponse,
  type SubjectDataExportResponse,
} from "../schemas/admin.data";

interface Principal {
  id: string;
  role: string;
  orgId: string;
  token: string;
}

export interface SecurityLogPayload {
  event: "data_delete" | "data_export";
  orgId: string;
  principal: string;
  subjectUserId?: string;
  subjectEmail?: string;
  mode?: "anonymized" | "deleted";
}

const PASSWORD_PLACEHOLDER = "__deleted__";

type SharedDbModule = typeof import("../../../../shared/src/db.js");
type PrismaClientLike = Pick<SharedDbModule["prisma"], "user" | "bankLine"> & {
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

type AccessLogClient = NonNullable<PrismaClientLike["accessLog"]>;

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
  auditLog?: AuditLogWriter;
  now?: () => Date;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {},
): Promise<void> {
  const prisma = deps.prisma ?? (await getDefaultPrisma());
  const securityLogger =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });
  const auditLogger = deps.auditLog ?? createAuditLogWriter();
  const now = deps.now ?? (() => new Date());

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
      subject.orgId,
    );

    const occurredAt = now().toISOString();
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

    await auditLogger.write({
      principal: principal.id,
      action: "admin.data.delete",
      scope: buildScope(body.orgId, subject.id),
      timestamp: occurredAt,
      metadata: { mode: response.action },
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

    const parsed = subjectDataExportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;

    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const userRecord = await prisma.user.findFirst({
      where: { orgId: body.orgId, email: body.email },
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

    const exportedAt = now().toISOString();

    const accessLog: AccessLogClient | undefined = prisma.accessLog;
    if (accessLog?.create) {
      await accessLog.create({
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

    await auditLogger.write({
      principal: principal.id,
      action: "admin.data.export",
      scope: buildScope(body.orgId, userRecord.id),
      timestamp: exportedAt,
    });

    const responsePayload: SubjectDataExportResponse = {
      org: {
        id: userRecord.org.id,
        name: maskOrgName(userRecord.org.name),
      },
      user: {
        id: userRecord.id,
        email: maskEmail(userRecord.email),
        createdAt: userRecord.createdAt.toISOString(),
      },
      relationships: {
        bankLinesCount,
      },
      exportedAt,
    };

    const validated = subjectDataExportResponseSchema.parse(responsePayload);

    return reply.send(validated);
  });
}

function parseAuthorization(request: FastifyRequest): Principal | null {
  const header = request.headers["authorization"] ?? request.headers["Authorization" as keyof typeof request.headers];
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

async function detectForeignKeyRisk(
  prisma: PrismaClientLike,
  userId: string,
  email: string,
  orgId: string,
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

function maskEmail(email: string): string {
  if (!email.includes("@")) {
    return "xx@xx";
  }
  const [localPart, domainPart] = email.split("@");
  const visibleLocal = localPart.slice(0, Math.min(2, localPart.length));
  const maskedLocal = `${visibleLocal}${"x".repeat(Math.max(1, localPart.length - visibleLocal.length))}`;
  const [domainLabel, ...rest] = domainPart.split(".");
  if (!domainLabel) {
    return `${maskedLocal}@xx`;
  }
  const maskedDomainLabel = `${domainLabel.slice(0, 1)}${"x".repeat(Math.max(1, domainLabel.length - 1))}`;
  const maskedDomain = rest.length > 0 ? `${maskedDomainLabel}.${rest.join(".")}` : maskedDomainLabel;
  return `${maskedLocal}@${maskedDomain}`;
}

function maskOrgName(name: string): string {
  if (name.length <= 2) {
    return `${name[0] ?? "*"}*`;
  }
  const first = name[0];
  const last = name[name.length - 1];
  return `${first}${"*".repeat(name.length - 2)}${last}`;
}

function buildScope(orgId: string, subjectId: string): string {
  return `org:${orgId}:user:${subjectId}`;
}

let cachedDefaultPrisma: PrismaClientLike | null = null;

async function getDefaultPrisma(): Promise<PrismaClientLike> {
  if (!cachedDefaultPrisma) {
    const module = (await import("../../../../shared/src/db.js")) as SharedDbModule;
    cachedDefaultPrisma = module.prisma;
  }
  return cachedDefaultPrisma;
}

export type { AdminDataDeleteRequest, AdminDataDeleteResponse };

const adminDataPlugin: FastifyPluginAsync = async (app) => {
  const prisma = ((app as any).db ?? (await getDefaultPrisma())) as PrismaClientLike;
  const secLog = (app as any).secLog as AdminDataRouteDeps["secLog"];
  const auditLog = (app as any).auditLog as AuditLogWriter | undefined;
  await registerAdminDataRoutes(app, { prisma, secLog, auditLog });
};

export default adminDataPlugin;
