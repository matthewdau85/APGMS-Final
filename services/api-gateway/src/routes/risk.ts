import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppConfig } from "../config.js";

import { authGuard } from "../auth.js";
import { detectRisk, listRiskEvents } from "@apgms/shared"; // legacy.snapshot + records
import { metrics } from "../observability/metrics.js";
import { computeOrgRisk } from "@apgms/domain-policy/risk/anomaly";

/** We normalize user context from decorated fastify auth */
type OrgRequest = FastifyRequest & {
  org?: { orgId?: string };      // new format
  user?: { orgId?: string };     // legacy format
};

/** Converts logical LOW/MEDIUM/HIGH → numeric gauge */
function riskLevelToNumeric(level: string): number {
  switch (level) {
    case "LOW": return 1;
    case "MEDIUM": return 2;
    case "HIGH": return 3;
    default: return 0;
  }
}

export async function registerRiskRoutes(
  app: FastifyInstance,
  _config: AppConfig
): Promise<void> {
  /**
   * LEGACY ROUTE: event-level fraud/anomaly risk
   * We keep this to maintain backward compatibility with monitoring tools.
   */
  app.get("/monitor/risk", { preHandler: authGuard }, async (request: OrgRequest, reply: FastifyReply) => {
    const orgId = request.org?.orgId ?? request.user?.orgId;
    if (!orgId) return reply.code(401).send({ error: "unauthenticated" });

    const taxType = String(
      (request.query as { taxType?: string }).taxType ?? "PAYGW"
    );

    const result = await detectRisk(orgId, taxType);
    metrics.riskEventsTotal.inc({ severity: result.record.severity });

    return reply.send({ risk: result.record, snapshot: result.snapshot });
  });

  /**
   * LEGACY ROUTE: historical flagged events
   */
  app.get("/monitor/risk/events", { preHandler: authGuard }, async (request: OrgRequest, reply: FastifyReply) => {
    const orgId = request.org?.orgId ?? request.user?.orgId;
    if (!orgId) return reply.code(401).send({ error: "unauthenticated" });

    const events = await listRiskEvents(orgId);
    return reply.send({ events });
  });

  /**
   * NEW ROUTE: full org risk summary (ledger + behavioural + anomaly rating)
   * Integrates actual tax ledger and obligations anomalies.
   */
  app.get("/monitor/risk/summary", { preHandler: authGuard }, async (request: OrgRequest, reply: FastifyReply) => {
    const orgId = request.org?.orgId ?? request.user?.orgId;
    if (!orgId) return reply.code(401).send({ error: "unauthenticated" });

    const period = String((request.query as { period?: string }).period ?? "");
    const snapshot = await computeOrgRisk(orgId, period);

    // Prometheus gauge if registered
    if ((metrics as any).orgRiskScoreGauge) {
      (metrics as any).orgRiskScoreGauge.set(
        { orgId, period },
        riskLevelToNumeric(snapshot.overallLevel)
      );
    }

    return reply.send(snapshot);
  });
}
