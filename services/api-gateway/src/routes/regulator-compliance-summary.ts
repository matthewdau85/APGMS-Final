import { type FastifyPluginAsync } from "fastify";
import { computeRegulatorComplianceSummary } from "../services/regulator-compliance-summary.service.js";

/**
 * GET /regulator/compliance/summary
 * GET /api/regulator/compliance/summary (secured via scope)
 */
export const regulatorComplianceSummaryRoute: FastifyPluginAsync = async (app) => {
  app.get("/regulator/compliance/summary", async (req, reply) => {
    const period = String((req.query as any)?.period ?? "2025-Q3");

    const result = await computeRegulatorComplianceSummary({
      db: app.db,
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

