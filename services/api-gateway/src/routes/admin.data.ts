import { createHash } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  maskError,
  createAppendOnlyAuditLog,
  type AppendOnlyAuditLog,
} from "@apgms/shared";

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

const PASSWORD_PLACEHOLDER = "__deleted__";

type PrismaClientLike = {
  user: {
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
    deleteMany: (args: any) => Promise<{ count: number }>;
  };
  bankLine: {
    count: (args: any) => Promise<number>;
    deleteMany: (args: any) => Promise<{ count: number }>;
  };
};

type PrismaAuditClient = {
  adminAuditLog: {
    findFirst: (args: any) => Promise<{ hash: string } | null>;
    create: (args: any) => Promise<{ hash: string }>;
  };
  $transaction: <T>(fn: (tx: PrismaAuditClient) => Promise<T>) => Promise<T>;
};

type AccessLogClient = {
  create: (args: {
    data: {
      event: string;
      orgId: string;
      principalId: string;
      subjectEmail: string;
    };
  }) => Promise<unknown>;
};

export interface AdminPrincipal {
  id: string;
  role: "admin" | "user";
  orgId: string;
  email: string;
}

type AdminAuthVerifier = (request: FastifyRequest) => Promise<AdminPrincipal | null>;

type DbSpanRunner = <T>(
  request: FastifyRequest | undefined,
  model: string | undefined,
  operation: string,
  fn: () => Promise<T>
) => Promise<T>;

export type SecurityLogPayload =
  | {
      event: "data_delete";
      orgId: string;
      principal: string;
      subjectUserId: string;
      mode: "anonymized" | "deleted";
      occurredAt: string;
    }
  | {
      event: "data_export";
      orgId: string;
      principal: string;
      subjectEmail: string;
      occurredAt: string;
    };

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  auth?: { verify: AdminAuthVerifier };
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
  accessLog?: AccessLogClient;
  auditLog?: AppendOnlyAuditLog;
  dbSpan?: DbSpanRunner;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {}
) {
  const prisma = deps.prisma ?? (await getDefaultPrisma());
  const verifyAdmin = deps.auth?.verify ?? defaultAuthVerifier;
  const securityLogger =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });
  const accessLog = deps.accessLog ?? ((prisma as unknown as { accessLog?: AccessLogClient }).accessLog ?? undefined);
  const auditLog =
    deps.auditLog ?? createAppendOnlyAuditLog(prisma as unknown as PrismaAuditClient);
  const dbSpan: DbSpanRunner =
    deps.dbSpan ?? (async (_request, _model, _operation, fn) => fn());

  app.post("/admin/data/export", async (request, reply) => {
    const principal = await authorizeAdmin(request, reply, verifyAdmin);
    if (!principal) {
      return;
    }

    const parsedBody = subjectDataExportRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsedBody.data;
    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const userRecord = (await dbSpan(request, "user", "findFirst", () =>
      prisma.user.findFirst({
        where: { orgId: body.orgId, email: body.email },
        select: {
          id: true,
          email: true,
          createdAt: true,
          org: { select: { id: true, name: true } },
        },
      })
    )) as
      | {
          id: string;
          email: string;
          createdAt: Date;
          org: { id: string; name: string };
        }
      | null;

    if (!userRecord) {
      return reply.code(404).send({ error: "not_found" });
    }

    const bankLinesCount = await dbSpan(request, "bankLine", "count", () =>
      prisma.bankLine.count({ where: { orgId: body.orgId } })
    );
    const exportedAt = new Date();

    if (accessLog) {
      await dbSpan(request, "accessLog", "create", () =>
        accessLog.create({
          data: {
            event: "data_export",
            orgId: body.orgId,
            principalId: principal.id,
            subjectEmail: body.email,
          },
        })
      );
    }

    await securityLogger({
      event: "data_export",
      orgId: body.orgId,
      principal: principal.id,
      subjectEmail: body.email,
      occurredAt: exportedAt.toISOString(),
    });

    await dbSpan(request, "adminAuditLog", "append", () =>
      auditLog.append({
        event: "data_export",
        orgId: body.orgId,
        principalId: principal.id,
        occurredAt: exportedAt,
        payload: {
          subjectEmail: body.email,
          bankLinesCount,
        },
      })
    );

    const responsePayload: SubjectDataExportResponse = subjectDataExportResponseSchema.parse({
      org: { id: userRecord.org.id, name: userRecord.org.name },
      user: {
        id: userRecord.id,
        email: userRecord.email,
        createdAt: userRecord.createdAt.toISOString(),
      },
      relationships: { bankLinesCount },
      exportedAt: exportedAt.toISOString(),
    });

    return reply.send(responsePayload);
  });

  app.post("/admin/data/delete", async (request, reply) => {
    const principal = await authorizeAdmin(request, reply, verifyAdmin);
    if (!principal) {
      return;
    }

    const parsed = adminDataDeleteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;
    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const subject = (await dbSpan(request, "user", "findFirst", () =>
      prisma.user.findFirst({
        where: { orgId: body.orgId, email: body.email },
      })
    )) as
      | {
          id: string;
          email: string;
          orgId: string;
          password: string | null;
        }
      | null;

    if (!subject) {
      return reply.code(404).send({ error: "not_found" });
    }

    const hasConstraintRisk = await detectForeignKeyRisk(
      prisma,
      subject.id,
      subject.email,
      subject.orgId,
      request,
      dbSpan
    );

    const occurredAt = new Date();
    let response: AdminDataDeleteResponse;

    if (hasConstraintRisk) {
      const anonymizedEmail = anonymizeEmail(subject.email, subject.id);
      await dbSpan(request, "user", "update", () =>
        prisma.user.update({
          where: { id: subject.id },
          data: {
            email: anonymizedEmail,
            password: PASSWORD_PLACEHOLDER,
          },
        })
      );

      response = adminDataDeleteResponseSchema.parse({
        action: "anonymized",
        userId: subject.id,
        occurredAt: occurredAt.toISOString(),
      });
    } else {
      await dbSpan(request, "user", "delete", () => prisma.user.delete({ where: { id: subject.id } }));
      response = adminDataDeleteResponseSchema.parse({
        action: "deleted",
        userId: subject.id,
        occurredAt: occurredAt.toISOString(),
      });
    }

    await securityLogger({
      event: "data_delete",
      orgId: body.orgId,
      principal: principal.id,
      subjectUserId: subject.id,
      mode: response.action,
      occurredAt: occurredAt.toISOString(),
    });

    await dbSpan(request, "adminAuditLog", "append", () =>
      auditLog.append({
        event: "data_delete",
        orgId: body.orgId,
        principalId: principal.id,
        occurredAt,
        payload: {
          subjectUserId: subject.id,
          mode: response.action,
        },
      })
    );

    return reply.code(202).send(response);
  });
}

async function authorizeAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  verify: AdminAuthVerifier
): Promise<AdminPrincipal | null> {
  try {
    const principal = await verify(request);
    if (!principal) {
      await reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    if (principal.role !== "admin") {
      await reply.code(403).send({ error: "forbidden" });
      return null;
    }
    return principal;
  } catch (error) {
    request.log.warn({ err: maskError(error) }, "admin_auth_failed");
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
}

const defaultAuthVerifier: AdminAuthVerifier = async () => null;

async function detectForeignKeyRisk(
  prisma: PrismaClientLike,
  userId: string,
  email: string,
  orgId: string,
  request: FastifyRequest,
  dbSpan: DbSpanRunner
): Promise<boolean> {
  const relatedLines = await dbSpan(request, "bankLine", "count", () =>
    prisma.bankLine.count({
      where: {
        orgId,
        payee: email,
      },
    })
  );

  if (relatedLines > 0) {
    return true;
  }

  const otherRefs = await dbSpan(request, "bankLine", "count", () =>
    prisma.bankLine.count({
      where: {
        orgId,
        desc: {
          contains: userId,
        },
      },
    })
  );

  return otherRefs > 0;
}

function anonymizeEmail(email: string, userId: string): string {
  const hash = createHash("sha256").update(`${email}:${userId}`).digest("hex");
  return `deleted+${hash.slice(0, 12)}@example.com`;
}

let cachedDefaultPrisma: PrismaClientLike | null = null;

async function getDefaultPrisma(): Promise<PrismaClientLike> {
  if (!cachedDefaultPrisma) {
    const module = await import("@apgms/shared/db");
    cachedDefaultPrisma = module.prisma as unknown as PrismaClientLike;
  }
  return cachedDefaultPrisma;
}

export type {
  AdminDataDeleteRequest,
  AdminDataDeleteResponse,
  SubjectDataExportRequest,
  SubjectDataExportResponse,
};
