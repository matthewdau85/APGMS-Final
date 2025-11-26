// services/api-gateway/src/routes/admin.data.ts
import type { FastifyInstance } from "fastify";

export async function registerAdminDataRoutes(app: FastifyInstance) {
  // TODO: implement real admin data routes.
  // This stub keeps the app booting cleanly.
  app.get("/admin/health", async () => ({ status: "ok" }));
}
