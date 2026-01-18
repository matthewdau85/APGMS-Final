// services/api-gateway/src/routes/demo.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

const bankSchema = z.object({
  daysBack: z.number().int().min(1).max(30).default(7),
  intensity: z.enum(["low", "high"]).default("low"),
});

/**
 * Demo routes:
 * - Only registered when ENABLE_PROTOTYPE=true
 * - Guarded by prototypeAdminGuard (header or admin auth)
 *
 * NOTE: When registerDemoRoutes() is called inside routes/prototype.ts,
 * these endpoints are effectively mounted at:
 *   /prototype/demo/*
 */
export async function registerDemoRoutes(app: FastifyInstance) {
  const enabled = String(process.env.ENABLE_PROTOTYPE ?? "").toLowerCase() === "true";
  if (!enabled) return;

  // Guard demo endpoints as well (belt-and-braces)
  app.addHook("preHandler", prototypeAdminGuard({ requireHeader: "x-prototype-admin" }));

  app.post("/demo/banking/generate", async (req) => {
    const parsed = bankSchema.safeParse(req.body);
    if (!parsed.success) {
      return { ok: false, error: "invalid_body", details: parsed.error.flatten() };
    }

    const { daysBack, intensity } = parsed.data;

    // Phase 1: stub response only (Phase 2 will add real state + event stream)
    return {
      ok: true,
      generated: daysBack,
      intensity,
      note: "Prototype demo bank feed generated (stub)",
    };
  });

  // Simple state endpoint for wiring tests
  app.get("/demo/state", async () => {
    return {
      ok: true,
      state: {
        org: "demo_org_001",
        obligations: [],
        settings: {},
      },
    };
  });
}
