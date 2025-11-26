import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authGuard } from "../auth.js";
import { detectRisk, listRiskEvents } from "@apgms/shared";
import { metrics } from "../observability/metrics.js";

type RiskRequest = FastifyRequest & { user?: { orgId?: string } };

export async function registerRiskRoutes(app: FastifyInstance) {
  app.get("/monitor/risk", { preHandler: authGuard }, async (request: RiskRequest, reply: FastifyReply) => {
    const orgId = request.user?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    const taxType = String((request.query as { taxType?: string }).taxType ?? "PAYGW");
    const result = await detectRisk(orgId, taxType);
    metrics.riskEventsTotal.inc({ severity: result.record.severity });
    reply.send({ risk: result.record, snapshot: result.snapshot });
  });

  app.get("/monitor/risk/events", { preHandler: authGuard }, async (request: RiskRequest, reply: FastifyReply) => {
    const orgId = request.user?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    const events = await listRiskEvents(orgId);
    reply.send({ events });
  });
}
