import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { z } from "zod";

import { authGuard } from "../auth.js";
import { detectRisk, listRiskEvents } from "../operations/risk.js";
import { metrics } from "../observability/metrics.js";

type RiskRequest = FastifyRequest & { user?: { orgId?: string } };

const RISK_TAX_TYPES = ["PAYGW", "GST"] as const;

const riskQuerySchema = z.object({
  taxType: z.enum(RISK_TAX_TYPES).default("PAYGW"),
});

export async function registerRiskRoutes(app: FastifyInstance) {
  app.get("/monitor/risk", { preHandler: authGuard }, async (request: RiskRequest, reply: FastifyReply) => {
    const orgId = request.user?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    const parsedQuery = riskQuerySchema.safeParse(request.query ?? {});
    if (!parsedQuery.success) {
      reply
        .code(400)
        .send({ error: { code: "invalid_query", details: parsedQuery.error.flatten() } });
      return;
    }

    const taxType = parsedQuery.data.taxType;
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
