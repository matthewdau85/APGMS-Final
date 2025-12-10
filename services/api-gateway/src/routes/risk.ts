// services/api-gateway/src/routes/risk.ts

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { authGuard } from "../auth.js";

// TODO[tech-debt]: replace stubbed risk engine with real @apgms/shared implementation

type RiskRecord = {
  id: string;
  severity: "low" | "medium" | "high";
  message: string;
};

type RiskSnapshot = {
  orgId: string;
  taxType: string;
  updatedAt: string;
};

type RiskEvent = {
  id: string;
  orgId: string;
  taxType: string;
  occurredAt: string;
  severity: "low" | "medium" | "high";
  message: string;
};

// TEMP: simple dev stub – always returns a low-risk snapshot
async function detectRiskStub(
  orgId: string,
  taxType: string,
): Promise<{ record: RiskRecord; snapshot: RiskSnapshot }> {
  return {
    record: {
      id: `${orgId}-${taxType}-demo`,
      severity: "low",
      message: "Risk engine disabled in dev environment",
    },
    snapshot: {
      orgId,
      taxType,
      updatedAt: new Date().toISOString(),
    },
  };
}

// TEMP: simple dev stub – empty event history
async function listRiskEventsStub(
  _orgId: string,
  _taxType: string,
): Promise<RiskEvent[]> {
  return [];
}

type RiskRequest = FastifyRequest & {
  user?: { orgId?: string };
};

export async function registerRiskRoutes(app: FastifyInstance) {
  // Snapshot endpoint
  app.get(
    "/monitor/risk",
    { preHandler: authGuard },
    async (request: RiskRequest, reply: FastifyReply) => {
      const orgId = request.user?.orgId;
      if (!orgId) {
        reply.code(401).send({ error: "unauthenticated" });
        return;
      }

      const taxType = String(
        (request.query as { taxType?: string }).taxType ?? "PAYGW",
      );

      const result = await detectRiskStub(orgId, taxType);

      reply.send({
        risk: result.record,
        snapshot: result.snapshot,
      });
    },
  );

  // Event history endpoint
  app.get(
    "/monitor/risk/events",
    { preHandler: authGuard },
    async (request: RiskRequest, reply: FastifyReply) => {
      const orgId = request.user?.orgId;
      if (!orgId) {
        reply.code(401).send({ error: "unauthenticated" });
        return;
      }

      const taxType = String(
        (request.query as { taxType?: string }).taxType ?? "PAYGW",
      );

      const events = await listRiskEventsStub(orgId, taxType);

      reply.send({ events });
    },
  );

  // Disabled risk recompute
  app.get(
    "/monitor/risk/recompute",
    { preHandler: authGuard },
    async (_request: RiskRequest, reply: FastifyReply) => {
      reply.code(200).send({ status: "no-risk-engine" });
    },
  );
}
