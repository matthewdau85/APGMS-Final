import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authGuard } from "../auth.js";
import { complianceSnapshot } from "@apgms/shared";

type MonitoringRequest = FastifyRequest & { user?: { orgId?: string } };

export async function registerMonitoringRoutes(app: FastifyInstance) {
  app.get("/monitor/compliance", { preHandler: authGuard }, async (request: MonitoringRequest, reply: FastifyReply) => {
    const orgId = request.user?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    const snapshot = await complianceSnapshot(orgId);
    reply.send({ snapshot });
  });
}
