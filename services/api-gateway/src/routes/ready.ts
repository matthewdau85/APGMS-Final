// services/api-gateway/src/routes/ready.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";

export default async function readyRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/ready", async () => {
    return {
      ok: true,
      service: "api-gateway",
      time_utc: new Date().toISOString(),
    };
  });
}
