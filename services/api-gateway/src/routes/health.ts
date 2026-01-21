// services/api-gateway/src/routes/health.ts
import type { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ok: true }));
}
