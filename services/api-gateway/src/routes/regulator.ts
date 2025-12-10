// services/api-gateway/src/routes/regulator.ts

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyPluginAsync,
} from "fastify";

export async function regulatorAuthGuard(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const apiKey = request.headers["x-reg-api-key"];

  if (!apiKey || typeof apiKey !== "string") {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Missing regulator API key" },
    });
  }
}

export const registerRegulatorRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  // Minimal stub route; extend later.
  app.get("/ping", async () => ({ ok: true }));
};
