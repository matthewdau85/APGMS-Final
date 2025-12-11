import type { FastifyInstance } from "fastify";

interface BasPrepareBody {
  period?: string;
}

type BasStatus = "PREPARED" | "SENT" | "ACK" | "FAILED";

interface BasSettlement {
  status: BasStatus;
  payload: unknown;
}

const settlementStore = new Map<string, BasSettlement>();

const periodPattern = /^\d{4}-Q[1-4]$/;

const isValidPeriod = (period: string | undefined): period is string =>
  typeof period === "string" && periodPattern.test(period);

function registerBasSettlementOnPath(app: FastifyInstance, base: string) {
  const path = (p: string) => `${base}${p}`;

  // prepare
  app.post<{ Body: BasPrepareBody }>(
    path("/bas/settlements/prepare"),
    async (request, reply) => {
      const auth = request.headers["authorization"];
      const orgId = request.headers["x-org-id"];

      if (!auth || !orgId) {
        return reply.code(401).send({
          error: {
            message: "Unauthorized",
            code: "UNAUTHENTICATED",
          },
        });
      }

      const { period } = request.body ?? {};

      if (!isValidPeriod(period)) {
        return reply.code(400).send({
          error: {
            message: "Invalid period",
            code: "BAD_REQUEST",
          },
        });
      }

      const instructionId = "settlement-1";
      const payload = { foo: "bar" };

      settlementStore.set(instructionId, {
        status: "PREPARED",
        payload,
      });

      return reply.code(201).send({ instructionId, payload });
    },
  );

  // sent
  app.post<{ Params: { instructionId: string } }>(
    path("/bas/settlements/:instructionId/sent"),
    async (request, reply) => {
      const { instructionId } = request.params;
      const settlement = settlementStore.get(instructionId);

      if (!settlement) {
        return reply.code(404).send({
          error: {
            message: "Settlement not found",
            code: "NOT_FOUND",
          },
        });
      }

      settlement.status = "SENT";

      return reply.code(200).send({
        instructionId,
        status: "SENT",
      });
    },
  );

  // ack
  app.post<{ Params: { instructionId: string } }>(
    path("/bas/settlements/:instructionId/ack"),
    async (request, reply) => {
      const { instructionId } = request.params;
      const settlement = settlementStore.get(instructionId);

      if (!settlement) {
        return reply.code(404).send({
          error: {
            message: "Settlement not found",
            code: "NOT_FOUND",
          },
        });
      }

      settlement.status = "ACK";

      return reply.code(200).send({
        instructionId,
        status: "ACK",
      });
    },
  );

  // failed
  app.post<{ Params: { instructionId: string } }>(
    path("/bas/settlements/:instructionId/failed"),
    async (request, reply) => {
      const { instructionId } = request.params;
      const settlement = settlementStore.get(instructionId);

      if (!settlement) {
        return reply.code(404).send({
          error: {
            message: "Settlement not found",
            code: "NOT_FOUND",
          },
        });
      }

      settlement.status = "FAILED";

      return reply.code(200).send({
        instructionId,
        status: "FAILED",
      });
    },
  );
}

export async function registerBasSettlementRoutes(app: FastifyInstance) {
  // Cover both plain and /api-prefixed URLs used in tests / app
  registerBasSettlementOnPath(app, "");
  registerBasSettlementOnPath(app, "/api");
}
