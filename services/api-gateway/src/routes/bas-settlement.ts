// services/api-gateway/src/routes/bas-settlement.ts

import { FastifyInstance } from "fastify";
import { prepareBasSettlementInstruction } from "@apgms/domain-policy/settlement/bas-settlement";

const PERIOD_PATTERN = "^[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])$";

export async function basSettlementRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/settlements/bas/finalise",
    {
      schema: {
        body: {
          type: "object",
          required: ["period"],
          properties: {
            period: {
              type: "string",
              pattern: PERIOD_PATTERN,
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              instructionId: { type: "string" },
              payload: { type: "object" },
            },
          },
        },
      },
      // auth/authz configuration is applied at the secure scope in app.ts
    },
    async (request, reply) => {
      const { period } = request.body as { period: string };
      const orgId = (request as any).org?.orgId ?? (request as any).user?.orgId;

      // In the real system you might have stronger guarantees here
      if (!orgId) {
        // Rely on upstream auth in practice; this is a safeguard
        return reply.code(401).send({ error: "unauthenticated" });
      }

      const payload = await prepareBasSettlementInstruction(orgId, period);

      request.log.info({ payload }, "Prepared BAS settlement");

      return reply.code(201).send({
        instructionId: payload.id,
        payload,
      });
    },
  );
}
