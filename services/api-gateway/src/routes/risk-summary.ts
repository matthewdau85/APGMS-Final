import type { FastifyInstance } from "fastify";
import { riskBandGauge } from "../observability/metrics.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function gaugeForRisk(band: RiskBand): number {
  switch (band) {
    case "LOW":
      return 1;
    case "MEDIUM":
      return 2;
    case "HIGH":
      return 3;
    default:
      return 1;
  }
}

async function handler(req: any, reply: any) {
  const orgId = req.headers?.["x-org-id"];
  if (!orgId) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  // Default period so dashboard never hard-fails
  const period = req.query?.period ?? "current";

  // Test / prototype controlled
  const riskBand: RiskBand = req.query?.riskBand ?? "LOW";

  const gaugeVal = gaugeForRisk(riskBand);

  riskBandGauge.set(
    { orgId, period },
    gaugeVal,
  );

  return reply.send({
    orgId,
    period,
    risk: { riskBand },
  });
}

/**
 * ✅ NAMED EXPORT — this is what server.ts imports
 */
export function registerRiskSummaryRoute(app: FastifyInstance) {
  app.get("/monitor/risk/summary", handler);
}
