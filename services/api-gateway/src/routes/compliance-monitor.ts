// services/api-gateway/src/routes/compliance-monitor.ts

import type { FastifyInstance, FastifyPluginAsync } from "fastify";

/**
 * Temporary stub for the compliance monitor routes.
 *
 * The previous version imported deep internals from "@apgms/shared/ledger/ingest.js",
 * which are not exposed via the package's "exports" map. That caused
 * ERR_PACKAGE_PATH_NOT_EXPORTED at runtime when starting the API.
 *
 * This stub keeps the router wired into app.ts without relying on any
 * non-exported subpaths. You can expand this later using only public
 * shared exports or by introducing a proper internal module import.
 */
export const registerComplianceMonitorRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  // Simple health/check endpoint for now
  app.get("/compliance/monitor/ping", async () => {
    return {
      ok: true,
      service: "compliance-monitor",
      message: "Compliance monitor stub is running",
    };
  });

  // You can add more lightweight, self-contained endpoints here later, e.g.:
  // app.get("/compliance/monitor/summary", async () => {
  //   return { ok: true, summary: "Not yet implemented" };
  // });
};
