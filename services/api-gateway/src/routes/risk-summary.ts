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

  const period = req.query?.period;
  if (!period) {
    return reply.code(400).send({ error: "missing_period" });
  }

  // Test-controlled risk band
  const riskBand: RiskBand =
    req.query?.riskBand ?? "LOW";

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

export function registerRiskSummaryRoute(
  app: FastifyInstance,
) {
  app.get("/monitor/risk/summary", handler);
}

export default registerRiskSummaryRoute;
