// services/api-gateway/src/routes/health.ts

import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));
}
