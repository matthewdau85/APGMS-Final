// services/api-gateway/src/routes/demo.ts
import type { FastifyInstance } from "fastify";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

/**
 * Demo routes:
 * - available only when ENABLE_PROTOTYPE=true
 * - header-admin gated via prototypeAdminGuard (x-prototype-admin)
 *
 * Mounted at root under /demo/*
 */
export async function registerDemoRoutes(app: FastifyInstance) {
  // Guard everything in this plugin
  app.addHook("preHandler", prototypeAdminGuard());

  // One route only - do not duplicate if other modules add /demo
  app.get("/demo", async () => {
    return {
      ok: true,
      message: "Demo routes are enabled.",
    };
  });

  app.post("/demo/banking/generate", async (request) => {
    // Keep this minimal: you can replace with your full generator logic.
    const body = (request.body ?? {}) as any;
    const daysBack = Number(body.daysBack ?? 7);
    const intensity = String(body.intensity ?? "low");

    return {
      ok: true,
      generated: {
        daysBack,
        intensity,
      },
    };
  });

  app.post("/demo/seed", async (request) => {
    const body = (request.body ?? {}) as any;
    return {
      ok: true,
      seeded: {
        orgId: String(body.orgId ?? ""),
        caseId: String(body.caseId ?? ""),
        seed: String(body.seed ?? ""),
      },
    };
  });

  app.get("/demo/state", async (request) => {
    const q = (request.query ?? {}) as any;
    const orgId = String(q.orgId ?? "");
    return { ok: true, state: { orgId } };
  });

  app.post("/demo/sim/start", async (request) => {
    const body = (request.body ?? {}) as any;
    return { ok: true, sim: { orgId: String(body.orgId ?? ""), status: "started" } };
  });

  app.post("/demo/sim/stop", async (request) => {
    const body = (request.body ?? {}) as any;
    return { ok: true, sim: { orgId: String(body.orgId ?? ""), status: "stopped" } };
  });

  app.get("/demo/events", async (request) => {
    const q = (request.query ?? {}) as any;
    return {
      ok: true,
      orgId: String(q.orgId ?? ""),
      afterTs: Number(q.afterTs ?? 0),
      events: [],
    };
  });
}

export default registerDemoRoutes;
