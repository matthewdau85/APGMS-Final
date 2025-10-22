import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  adminDataDeleteRouteSchema,
  adminDataExportRequestSchema,
  adminDataExportResponseSchema,
  adminDataExportRouteSchema,
  type AdminDataDeleteRequest,
  type AdminDataDeleteResponse,
  type AdminDataExportRequest,
  type AdminDataExportResponse,
} from "../schemas/admin.data";

const EXPORT_VERSION = "2024-10-01";
const LOG_PRINCIPAL = "admin_token";

type SharedDbModule = typeof import("../../../../shared/src/db.js");
type PrismaClientLike = Pick<
  SharedDbModule["prisma"],
  "user" | "bankLine" | "orgTombstone"
>;

interface SubjectExportRecord {
  subjectId: string;
  orgId: string;
  createdAt: Date;
  bankLineCount: number;
}

interface DeleteSubjectResult {
  subjectId: string;
  orgId: string;
  deletedAt: Date;
}

export interface SecurityLogPayload {
  event: "admin_data_export" | "admin_data_delete";
  orgId: string;
  principal: string;
  subjectId: string;
  occurredAt: string;
}

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  getSubjectExport?: (subjectId: string) => Promise<SubjectExportRecord | null>;
  deleteSubject?: (subjectId: string) => Promise<DeleteSubjectResult | null>;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {}
) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error("ADMIN_TOKEN environment variable must be configured");
  }

  let prisma: PrismaClientLike | null = deps.prisma ?? null;
  const ensurePrisma = async (): Promise<PrismaClientLike> => {
    if (!prisma) {
      prisma = await getDefaultPrisma();
    }
    return prisma;
  };

  const getSubjectExport =
    deps.getSubjectExport ??
    (async (subjectId: string): Promise<SubjectExportRecord | null> => {
      const client = await ensurePrisma();
      const subject = await client.user.findUnique({
        where: { id: subjectId },
        select: { id: true, createdAt: true, orgId: true },
      });

      if (!subject) {
        return null;
      }

      const bankLineCount = await client.bankLine.count({
        where: { orgId: subject.orgId },
      });

      return {
        subjectId: subject.id,
        orgId: subject.orgId,
        createdAt: subject.createdAt,
        bankLineCount,
      };
    });

  const deleteSubject =
    deps.deleteSubject ??
    (async (subjectId: string): Promise<DeleteSubjectResult | null> => {
      const client = await ensurePrisma();
      const subject = await client.user.findUnique({
        where: { id: subjectId },
        select: { id: true, orgId: true },
      });

      if (!subject) {
        return null;
      }

      const deletedAt = new Date();
      await client.user.delete({ where: { id: subject.id } });
      await client.orgTombstone.create({
        data: {
          orgId: subject.orgId,
          payload: {
            type: "admin_subject_delete",
            subjectId: subject.id,
            deletedAt: deletedAt.toISOString(),
          },
        },
      });

      return {
        subjectId: subject.id,
        orgId: subject.orgId,
        deletedAt,
      };
    });

  const securityLogger =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });

  app.post<{
    Body: AdminDataExportRequest;
    Reply: AdminDataExportResponse | { error: string };
  }>(
    "/admin/data/export",
    { schema: adminDataExportRouteSchema },
    async (request, reply) => {
      if (!isAuthorized(request, adminToken)) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const parsed = adminDataExportRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const record = await getSubjectExport(parsed.data.subjectId);
      if (!record) {
        return reply.code(404).send({ error: "not_found" });
      }

      const exportedAt = new Date().toISOString();
      const responsePayload = adminDataExportResponseSchema.parse({
        version: EXPORT_VERSION,
        exportedAt,
        subject: {
          id: record.subjectId,
          orgId: record.orgId,
          createdAt: record.createdAt.toISOString(),
        },
        metadata: {
          redactedFields: ["email", "password"],
        },
        relationships: {
          bankLineCount: record.bankLineCount,
        },
      });

      await securityLogger({
        event: "admin_data_export",
        orgId: record.orgId,
        principal: LOG_PRINCIPAL,
        subjectId: record.subjectId,
        occurredAt: exportedAt,
      });

      return reply.code(200).send(responsePayload);
    }
  );

  app.post<{
    Body: AdminDataDeleteRequest;
    Reply: AdminDataDeleteResponse | { error: string };
  }>(
    "/admin/data/delete",
    { schema: adminDataDeleteRouteSchema },
    async (request, reply) => {
      if (!isAuthorized(request, adminToken)) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const parsed = adminDataDeleteRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const result = await deleteSubject(parsed.data.subjectId);
      if (!result) {
        return reply.code(404).send({ error: "not_found" });
      }

      const responsePayload = adminDataDeleteResponseSchema.parse({
        status: "deleted",
        subjectId: result.subjectId,
        deletedAt: result.deletedAt.toISOString(),
      });

      await securityLogger({
        event: "admin_data_delete",
        orgId: result.orgId,
        principal: LOG_PRINCIPAL,
        subjectId: result.subjectId,
        occurredAt: responsePayload.deletedAt,
      });

      return reply.code(202).send(responsePayload);
    }
  );
}

const isAuthorized = (request: FastifyRequest, expectedToken: string): boolean => {
  const header = request.headers["authorization"] ??
    request.headers["Authorization" as keyof typeof request.headers];

  if (!header || typeof header !== "string") {
    return false;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return false;
  }

  return match[1] === expectedToken;
};

let cachedDefaultPrisma: PrismaClientLike | null = null;

async function getDefaultPrisma(): Promise<PrismaClientLike> {
  if (!cachedDefaultPrisma) {
    const module = (await import("../../../../shared/src/db.js")) as SharedDbModule;
    cachedDefaultPrisma = module.prisma;
  }

  return cachedDefaultPrisma;
}

const adminDataPlugin: FastifyPluginAsync = async (app) => {
  await registerAdminDataRoutes(app);
};

export default adminDataPlugin;

export type {
  AdminDataDeleteRequest,
  AdminDataDeleteResponse,
  AdminDataExportRequest,
  AdminDataExportResponse,
};
