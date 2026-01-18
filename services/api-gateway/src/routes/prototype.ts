import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../plugins/auth.js";
import { registerDemoRoutes } from "./demo.js";

function isoNow() {
  return new Date().toISOString();
}

const routes: FastifyPluginAsync = async (app) => {
  // Entire prototype surface is real-admin only
  app.addHook("preHandler", requireAdmin);

  // Basic prototype endpoint (admin auth required)
  app.get("/overview", async (req) => {
    const period = (req.query as any)?.period?.toString() ?? "";
    if (!period) return { ok: false, error: "missing_period" };

    const orgId = (req.headers["x-org-id"] ?? "").toString() || null;

    return {
      ok: true,
      mode: "prototype",
      orgId,
      period,
      generatedAt: isoNow(),
      kpis: [
        { label: "Obligations due", value: 3, status: "amber" },
        { label: "Overdue", value: 0, status: "green" },
        { label: "Unreconciled items", value: 12, status: "amber" },
        { label: "Controls", value: "92%", status: "green" },
      ],
      timeline: [
        { at: "2025-01-05", type: "feed.bank.import", detail: "Imported 42 bank txns" },
        { at: "2025-01-10", type: "feed.payroll.import", detail: "Imported 8 payroll events" },
        { at: "2025-01-18", type: "recon.run", detail: "Matched 30 items automatically" },
        { at: "2025-01-20", type: "lodgment.bas.draft", detail: "Draft BAS created" },
      ],
    };
  });

  /**
   * IMPORTANT:
   * Demo endpoints mounted under /prototype/demo/*
   * They will apply THEIR OWN guard (prototype header guard).
   */
  await app.register(async (instance) => {
    await registerDemoRoutes(instance);
  }, { prefix: "/demo" });
};

export default routes;
