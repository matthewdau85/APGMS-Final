// services/api-gateway/src/routes/ingest-csv.ts

import { FastifyInstance, FastifyPluginOptions } from "fastify";

const PERIOD_PATTERN = "^[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])$";

export async function csvIngestRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  app.post(
    "/ingest/csv",
    {
      schema: {
        body: {
          type: "object",
          required: ["period", "rows"],
          properties: {
            period: {
              type: "string",
              pattern: PERIOD_PATTERN,
            },
            rows: {
              type: "array",
              items: {
                type: "object",
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { period, rows } = req.body as {
        period: string;
        rows: unknown[];
      };

      req.log.info({ period, rowCount: rows.length }, "CSV accepted for processing");

      return reply.code(202).send({
        status: "accepted",
        period,
        ingestedRows: rows.length,
        message: "CSV accepted for processing",
      });
    },
  );
}
