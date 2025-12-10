// services/api-gateway/src/routes/ingest-csv.ts

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { authGuard } from "../auth.js";
import { PERIOD_REGEX } from "../schemas/period.js";

type IngestBody = {
  period?: string;
  rows?: Array<Record<string, unknown>>;
};

export const csvIngestRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  app.post(
    "/ingest/csv",
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.headers["x-org-id"];
      const body = request.body as IngestBody;

      if (!orgId || typeof orgId !== "string") {
        reply
          .code(401)
          .send({ error: { code: "missing_org", message: "x-org-id required" } });
        return;
      }

      const period = body?.period ?? "";
      if (!PERIOD_REGEX.test(period)) {
        reply.code(400).send({
          error: {
            code: "invalid_period",
            message: "Period must be YYYY-Qn or YYYY-MM",
          },
        });
        return;
      }

      const rows = body?.rows ?? [];
      const ingestedRows = rows.length;

      reply.code(202).send({
        orgId,
        period,
        ingestedRows,
      });
    },
  );
};
