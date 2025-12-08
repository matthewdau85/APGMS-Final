// services/api-gateway/src/routes/ingest-csv.ts

import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth.js";
import { AppError } from "../errors.js";

const PERIOD_REGEX = /^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/;

export async function registerIngestCsvRoutes(app: FastifyInstance) {
  app.post(
    "/ingest/csv",
    {
      preHandler: [authGuard],
      schema: {
        body: {
          type: "object",
          required: ["period", "rows"],
          properties: {
            period: { type: "string" },
            rows: {
              type: "array",
              items: { type: "object" }, // refine later if you want
            },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = request.headers["x-org-id"];
      const body = request.body as { period: string; rows: unknown[] };

      if (!orgId || typeof orgId !== "string") {
        throw new AppError("missing_org", 400, "x-org-id header is required");
      }

      if (!PERIOD_REGEX.test(body.period)) {
        throw new AppError(
          "invalid_period",
          400,
          "Period must be YYYY-Qn or YYYY-MM",
        );
      }

      // TODO: actual ingestion; stub for now:
      const ingestedRows = body.rows.length;

      return reply.code(202).send({
        orgId,
        period: body.period,
        ingestedRows,
      });
    },
  );
}
