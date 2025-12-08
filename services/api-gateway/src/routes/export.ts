// services/api-gateway/src/routes/export.ts

import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth.js";
import { AppError } from "../errors.js";
import { PERIOD_REGEX } from "../schema/period.js"; // or inline regex if you prefer

export async function registerExportRoutes(app: FastifyInstance) {
  app.get(
    "/export/bas/v1",
    {
      preHandler: [authGuard],
      schema: {
        querystring: {
          type: "object",
          required: ["period"],
          properties: {
            period: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = request.headers["x-org-id"];

      if (!orgId || typeof orgId !== "string") {
        throw new AppError("missing_org", 400, "x-org-id header is required");
      }

      const period = (request.query as { period: string }).period;

      if (!PERIOD_REGEX.test(period)) {
        throw new AppError(
          "invalid_period",
          400,
          "Period must be YYYY-Qn or YYYY-MM",
        );
      }

      // TODO: real implementation; stub for now
      return reply.code(200).send({
        orgId,
        period,
        lines: [],
      });
    },
  );

  app.get(
    "/export/bas.csv",
    {
      preHandler: [authGuard],
      schema: {
        querystring: {
          type: "object",
          required: ["period"],
          properties: {
            period: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = request.headers["x-org-id"];

      if (!orgId || typeof orgId !== "string") {
        throw new AppError("missing_org", 400, "x-org-id header is required");
      }

      const period = (request.query as { period: string }).period;

      if (!PERIOD_REGEX.test(period)) {
        throw new AppError(
          "invalid_period",
          400,
          "Period must be YYYY-Qn or YYYY-MM",
        );
      }

      // TODO: real CSV export; stub for now
      reply.header("content-type", "text/csv");
      reply.send("orgId,period\n" + `${orgId},${period}\n`);
    },
  );
}
