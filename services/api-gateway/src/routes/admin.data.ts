import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data";
import type {
  AdminDataDeleteRequest,
  AdminDataDeleteResponse,
  SubjectDataExportRequest,
  SubjectDataExportResponse,
} from "../schemas/admin.data";

interface DataDeleteSecurityLogPayload {
  event: "data_delete";
  orgId: string;
  principal: string;
  subjectUserId: string;
  mode: "anonymized" | "deleted";
}

interface DataExportSecurityLogPayload {
  event: "data_export";
  orgId: string;
  principal: string;
  subjectEmail: string;
}

export type SecurityLogPayload =
  | DataDeleteSecurityLogPayload
  | DataExportSecurityLogPayload;

const PASSWORD_PLACEHOLDER = "__deleted__";

type SharedDbModule = typeof import("../../../../shared/src/db.js");
type PrismaClientLike =
  Pick<SharedDbModule["prisma"], "user" | "bankLine"> & {
    accessLog?: SharedDbModule["prisma"]["accessLog"];
  };

type AccessLogClient = NonNullable<PrismaClientLike["accessLog"]>;

type SecurityLogFn = (payload: SecurityLogPayload) => Promise<void> | void;

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  accessLog?: AccessLogClient;
  secLog?: SecurityLogFn;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {}
) {
  const prisma = deps.prisma ?? (await getDefaultPrisma());
  const accessLogClient = deps.accessLog ?? prisma.accessLog;
  const securityLogger: SecurityLogFn =
    deps.secLog ??
    ((payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });

  app.post("/admin/data/delete", async (request, reply) => {
    if (!isAuthorized(request)) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const parsed = adminDataDeleteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;

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
      principal: getAdminPrincipalId(),
      subjectUserId: subject.id,
      mode: response.action,
    });

    return reply.code(202).send(response);
  });

  app.post("/admin/data/export", async (request, reply) => {
    if (!isAuthorized(request)) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const parsed = subjectDataExportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;

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

    if (accessLogClient?.create) {
      await accessLogClient.create({
        data: {
          event: "data_export",
          orgId: body.orgId,
          principalId: getAdminPrincipalId(),
          subjectEmail: body.email,
        },
      });
    }

    await securityLogger({
      event: "data_export",
      orgId: body.orgId,
      principal: getAdminPrincipalId(),
      subjectEmail: body.email,
    });

    const responsePayload: SubjectDataExportResponse =
      subjectDataExportResponseSchema.parse({
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
}

function isAuthorized(request: FastifyRequest): boolean {
  const adminToken = getAdminToken();
  if (!adminToken) {
    request.log.error("ADMIN_TOKEN is not configured");
    return false;
  }

  const header = request.headers["authorization"];
  if (!header || typeof header !== "string") {
    return false;
  }

  return header.trim() === `Bearer ${adminToken}`;
}

function getAdminToken(): string | undefined {
  return process.env.ADMIN_TOKEN;
}

function getAdminPrincipalId(): string {
  return process.env.ADMIN_PRINCIPAL_ID ?? "admin";
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
    cachedDefaultPrisma = module.prisma as PrismaClientLike;
  }
  return cachedDefaultPrisma;
}

const adminDataRoutes: FastifyPluginAsync = async (app) => {
  const db = (app as any).db as PrismaClientLike | undefined;
  const accessLog = (app as any).accessLog as AccessLogClient | undefined;
  const secLog = (app as any).secLog as SecurityLogFn | undefined;

  await registerAdminDataRoutes(app, {
    prisma: db,
    accessLog: accessLog ?? db?.accessLog,
    secLog,
  });
};

export default adminDataRoutes;

export type {
  AdminDataDeleteRequest,
  AdminDataDeleteResponse,
  SubjectDataExportRequest,
  SubjectDataExportResponse,
};
