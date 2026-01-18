// services/api-gateway/src/routes/prototype.ts
import type { FastifyPluginAsync } from "fastify";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";
import { registerDemoRoutes } from "./demo.js";

function isoNow() {
  return new Date().toISOString();
}

const routes: FastifyPluginAsync = async (app) => {
  // Entire /prototype surface is guarded by prototype-admin policy
  app.addHook("preHandler", prototypeAdminGuard({ requireHeader: "x-prototype-admin" }));

  // Minimal overview endpoint for Phase 1 wiring checks
  app.get("/overview", async (req) => {
    const period = String((req.query as any)?.period ?? "").trim();
    if (!period) return { ok: false, error: "missing_period" };

    return {
      ok: true,
      mode: "prototype",
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

  // IMPORTANT:
  // Demo routes are registered INSIDE this plugin.
  // Since this plugin is mounted with prefix "/prototype", demo endpoints become:
  //   /prototype/demo/...
  await registerDemoRoutes(app);
};

export default routes;
