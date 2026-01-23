// services/api-gateway/src/routes/evidence-pack.ts
import type { FastifyInstance } from "fastify";

export default async function evidencePackRoutes(app: FastifyInstance): Promise<void> {
  // Minimal placeholder route; expand later to real evidence pack generation.
  app.get("/evidence-pack", async () => {
    return { ok: true };
  });
}
