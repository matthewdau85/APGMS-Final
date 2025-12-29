import type { FastifyInstance } from "fastify";
import { getServiceMode } from "../service-mode.js";

export default async function basSettlementRoutes(app: FastifyInstance) {
  app.post("/bas/settlement", async (_req, reply) => {
    const mode = getServiceMode();

    if (mode.mode === "suspended") {
      return reply.code(503).send({
        error: "SERVICE_SUSPENDED",
        message: "Service is temporarily suspended.",
        mode,
      });
    }

    if (mode.mode === "read-only") {
      return reply.code(503).send({
        error: "SERVICE_READ_ONLY",
        message: "Service is in read-only mode.",
        mode,
      });
    }

    return reply.send({ ok: true });
  });
}
