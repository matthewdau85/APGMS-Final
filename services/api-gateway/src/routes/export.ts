// services/api-gateway/src/routes/export.ts

import { FastifyInstance } from "fastify";
import { buildBasEvidencePack } from "@apgms/domain-policy/export/evidence";

const PERIOD_PATTERN = "^[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])$";

export async function exportRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/export/bas/v1",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["period"],
          properties: {
            period: {
              type: "string",
              pattern: PERIOD_PATTERN,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = (request as any).org?.orgId;
      const { period } = request.query as { period: string };

      const pack = await buildBasEvidencePack(orgId, period);
      return reply.send(pack);
    },
  );

  fastify.get(
    "/export/bas.csv",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["period"],
          properties: {
            period: {
              type: "string",
              pattern: PERIOD_PATTERN,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = (request as any).org?.orgId;
      const { period } = request.query as { period: string };

      const pack = await buildBasEvidencePack(orgId, period);

      // For now just return JSON; later you can set CSV headers + body
      return reply.send(pack);
    },
  );
}
