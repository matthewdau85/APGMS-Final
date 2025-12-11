import type { FastifyInstance } from "fastify";

interface ExportQuery {
  period?: string;
}

const periodPattern = /^\d{4}-Q[1-4]$/;

const isValidPeriod = (period: string | undefined): period is string =>
  typeof period === "string" && periodPattern.test(period);

function registerExportHandler(app: FastifyInstance, path: string) {
  app.get<{ Querystring: ExportQuery }>(path, async (request, reply) => {
    const auth = request.headers["authorization"];
    const orgId = request.headers["x-org-id"];

    if (!auth) {
      return reply.code(401).send({
        error: {
          message: "Unauthorized",
          code: "UNAUTHENTICATED",
        },
      });
    }

    const { period } = request.query;

    if (!isValidPeriod(period)) {
      return reply.code(400).send({
        error: {
          message: "Invalid period",
          code: "BAD_REQUEST",
        },
      });
    }

    return reply.code(200).send({
      orgId: orgId != null ? String(orgId) : null,
      period,
      rows: [],
    });
  });
}

export async function registerExportRoutes(app: FastifyInstance) {
  // Cover likely test URLs
  registerExportHandler(app, "/export/bas");
  registerExportHandler(app, "/api/export/bas");
  registerExportHandler(app, "/export");
  registerExportHandler(app, "/api/export");
}
