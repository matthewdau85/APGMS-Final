import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  adminDataDeleteRequestJsonSchema,
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseJsonSchema,
  adminDataDeleteResponseSchema,
  adminDataErrorResponseJsonSchema,
  adminDataErrorResponseSchema,
  adminDataExportRequestJsonSchema,
  adminDataExportRequestSchema,
  adminDataExportResponseJsonSchema,
  adminDataExportResponseSchema,
  type AdminDataExportResponse,
} from "../schemas/admin.data";

const EXPORT_VERSION = "2024-01-01";

export type AdminDataExportHandler = (
  subjectId: string
) => Promise<AdminDataExportResponse | null>;

export type AdminDataDeleteHandler = (
  subjectId: string
) => Promise<{ deletedAt: string } | null>;

export interface AdminDataPluginOptions {
  adminToken?: string;
  exportHandler?: AdminDataExportHandler;
  deleteHandler?: AdminDataDeleteHandler;
}

const defaultExportHandler: AdminDataExportHandler = async (subjectId) => ({
  version: EXPORT_VERSION,
  subjectId,
  exportedAt: new Date().toISOString(),
  data: { relationships: [] },
});

const defaultDeleteHandler: AdminDataDeleteHandler = async () => ({
  deletedAt: new Date().toISOString(),
});

const buildAuthorizationChecker = (
  adminToken: string | undefined
): ((request: FastifyRequest, reply: FastifyReply) => boolean) => {
  return (request, reply) => {
    const providedToken = extractBearerToken(request.headers.authorization);
    if (!adminToken || !providedToken || providedToken !== adminToken) {
      const payload = adminDataErrorResponseSchema.parse({ error: "unauthorized" });
      reply.code(401).send(payload);
      return false;
    }
    return true;
  };
};

const adminDataRoutes: FastifyPluginAsync<AdminDataPluginOptions> = async (
  app,
  options = {}
) => {
  const adminToken = options.adminToken ?? process.env.ADMIN_TOKEN;
  const exportHandler = options.exportHandler ?? defaultExportHandler;
  const deleteHandler = options.deleteHandler ?? defaultDeleteHandler;
  const ensureAuthorized = buildAuthorizationChecker(adminToken);

    app.post(
      "/admin/data/export",
      {
        attachValidation: true,
        schema: {
          tags: ["admin"],
          body: adminDataExportRequestJsonSchema,
          response: {
            200: adminDataExportResponseJsonSchema,
            400: adminDataErrorResponseJsonSchema,
            401: adminDataErrorResponseJsonSchema,
            404: adminDataErrorResponseJsonSchema,
          },
        },
      },
    async (request, reply) => {
      if (!ensureAuthorized(request, reply)) {
        return;
      }

      const hasValidationError = Boolean(
        (request as FastifyRequest & { validationError?: unknown }).validationError
      );
      if (hasValidationError) {
        const payload = adminDataErrorResponseSchema.parse({ error: "invalid_request" });
        reply.code(400).send(payload);
        return;
      }

      const parsedBody = adminDataExportRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        const payload = adminDataErrorResponseSchema.parse({ error: "invalid_request" });
        reply.code(400).send(payload);
        return;
      }

      const result = await exportHandler(parsedBody.data.subjectId);
      if (!result) {
        const payload = adminDataErrorResponseSchema.parse({ error: "not_found" });
        reply.code(404).send(payload);
        return;
      }

      const responsePayload = adminDataExportResponseSchema.parse(result);
      reply.send(responsePayload);
    }
  );

    app.post(
      "/admin/data/delete",
      {
        attachValidation: true,
        schema: {
          tags: ["admin"],
          body: adminDataDeleteRequestJsonSchema,
          response: {
            202: adminDataDeleteResponseJsonSchema,
            400: adminDataErrorResponseJsonSchema,
            401: adminDataErrorResponseJsonSchema,
            404: adminDataErrorResponseJsonSchema,
          },
        },
      },
    async (request, reply) => {
      if (!ensureAuthorized(request, reply)) {
        return;
      }

      const hasValidationError = Boolean(
        (request as FastifyRequest & { validationError?: unknown }).validationError
      );
      if (hasValidationError) {
        const payload = adminDataErrorResponseSchema.parse({ error: "invalid_request" });
        reply.code(400).send(payload);
        return;
      }

      const parsedBody = adminDataDeleteRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        const payload = adminDataErrorResponseSchema.parse({ error: "invalid_request" });
        reply.code(400).send(payload);
        return;
      }

      const deleted = await deleteHandler(parsedBody.data.subjectId);
      if (!deleted) {
        const payload = adminDataErrorResponseSchema.parse({ error: "not_found" });
        reply.code(404).send(payload);
        return;
      }

      const responsePayload = adminDataDeleteResponseSchema.parse({
        status: "deleted",
        subjectId: parsedBody.data.subjectId,
        deletedAt: deleted.deletedAt,
      });
      reply.code(202).send(responsePayload);
    }
  );
};

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export const registerAdminDataRoutes = adminDataRoutes;

export default adminDataRoutes;
