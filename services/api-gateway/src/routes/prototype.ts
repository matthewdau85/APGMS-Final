// services/api-gateway/src/routes/prototype.ts
import type { FastifyInstance } from "fastify";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

export default async function prototypeRoutes(app: FastifyInstance) {
  // Entire prototype surface is prototype-admin gated (header-based)
  app.addHook("preHandler", prototypeAdminGuard());

  app.get("/overview", async (request) => {
    const period = String((request.query as any)?.period ?? "");
    return {
      ok: true,
      mode: "prototype",
      period,
      notes: "Mock BAS obligation for prototype.",
    };
  });

  // Keep /demo here as a simple discoverability endpoint for humans
  app.get("/demo", async () => {
    return {
      ok: true,
      routes: [
        "POST /demo/banking/generate",
        "GET  /demo/state?orgId=...",
        "POST /demo/seed",
        "POST /demo/sim/start",
        "POST /demo/sim/stop",
        "GET  /demo/events?orgId=...&afterTs=0",
      ],
    };
  });
}
