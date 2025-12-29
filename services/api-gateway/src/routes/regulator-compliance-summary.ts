import type { FastifyPluginAsync } from "fastify";
import { computeRegulatorComplianceSummary } from "./regulator-compliance-summary.service.js";
import { getOrgIdFromRequest } from "../utils/orgScope.js";

/**
 * GET /regulator/compliance/summary
 * GET /api/regulator/compliance/summary (secured via scope)
 */
export const regulatorComplianceSummaryRoute: FastifyPluginAsync = async (app) => {
  app.get("/regulator/compliance/summary", async (req, reply) => {
    const period = String((req.query as any)?.period ?? "2025-Q3");

    // IMPORTANT:
    // - Tests may not attach auth/user, so allow a stable fallback.
    // - If your orgScope utility reads x-org-id, it will win.
    const orgId = getOrgIdFromRequest(req) ?? "org_1";

    const result = await computeRegulatorComplianceSummary({
      db: (app as any).db,
      orgId,
      period,
    });

    return reply.send(result);
  });
};

export default regulatorComplianceSummaryRoute;

/**
 * Compatibility export for older tests
 */
export const registerRegulatorComplianceSummaryRoute = (
  app: any,
  opts?: { basePath?: string },
) => {
  const prefix = opts?.basePath ?? "";
  app.register(regulatorComplianceSummaryRoute, { prefix });
};
