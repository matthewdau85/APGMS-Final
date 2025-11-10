import type { FastifyInstance } from "fastify";
import { registry } from "../metrics.js";

export async function registerMetricsRoute(app: FastifyInstance) {
  app.get("/metrics", async (_request, reply) => {
    const payload = await registry.metrics();

    reply
      .header("Content-Type", registry.contentType)
      .send(payload);
  });
}
