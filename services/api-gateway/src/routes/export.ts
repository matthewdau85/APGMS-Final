// services/api-gateway/src/routes/export.ts

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { authGuard } from "../auth.js";
import { PERIOD_REGEX } from "../schemas/period.js";

export const exportRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  // JSON export
  app.get(
    "/export/bas/v1",
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.headers["x-org-id"];
      const qs = request.query as { period?: string };

      if (!orgId || typeof orgId !== "string") {
        reply
          .code(401)
          .send({ error: { code: "missing_org", message: "x-org-id required" } });
        return;
      }

      const period = qs?.period ?? "";
      if (!PERIOD_REGEX.test(period)) {
        reply.code(400).send({
          error: {
            code: "invalid_period",
            message: "Period must be YYYY-Qn or YYYY-MM",
          },
        });
        return;
      }

      reply.code(200).send({
        orgId,
        period,
        lines: [],
      });
    },
  );

  // CSV export
  app.get(
    "/export/bas.csv",
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.headers["x-org-id"];
      const qs = request.query as { period?: string };

      if (!orgId || typeof orgId !== "string") {
        reply
          .code(401)
          .send({ error: { code: "missing_org", message: "x-org-id required" } });
        return;
      }

      const period = qs?.period ?? "";
      if (!PERIOD_REGEX.test(period)) {
        reply.code(400).send({
          error: {
            code: "invalid_period",
            message: "Period must be YYYY-Qn or YYYY-MM",
          },
        });
        return;
      }

      reply.header("content-type", "text/csv");
      reply.send(`orgId,period\n${orgId},${period}\n`);
    },
  );
};
