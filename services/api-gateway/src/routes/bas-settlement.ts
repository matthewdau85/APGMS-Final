// services/api-gateway/src/routes/bas-settlement.ts

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authGuard } from "../auth.js";

type PrepareBody = {
  period?: string;
};

type FailBody = {
  reason?: string;
};

// --- TEMP DOMAIN STUBS -------------------------------------------------
// These replace the old @apgms/domain-policy imports while the real
// settlement engine is being wired up. They deliberately return the
// smallest possible shapes just to let the API behave in dev.

async function prepareBasSettlementInstruction(
  orgId: string,
  period: string,
): Promise<{ id: string; orgId: string; period: string; status: string }> {
  return {
    id: `bas-settlement-${orgId}-${period}`,
    orgId,
    period,
    status: "prepared",
  };
}

async function markBasSettlementSent(
  id: string,
): Promise<{ id: string; status: string }> {
  return { id, status: "sent" };
}

async function markBasSettlementAcknowledged(
  id: string,
): Promise<{ id: string; status: string }> {
  return { id, status: "acknowledged" };
}

async function markBasSettlementFailed(
  id: string,
  reason: string,
): Promise<{ id: string; status: string; reason: string }> {
  return { id, status: "failed", reason };
}

// -----------------------------------------------------------------------

export async function registerBasSettlementRoutes(app: FastifyInstance) {
  // Prepare a BAS settlement instruction for a given period
  app.post(
    "/settlements/bas/prepare",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgIdHeader = request.headers["x-org-id"];
      if (!orgIdHeader || typeof orgIdHeader !== "string") {
        reply.code(401).send({
          error: { code: "missing_org", message: "x-org-id header is required" },
        });
        return;
      }

      const body = (request.body ?? {}) as PrepareBody;
      const period = (body.period ?? "").trim();
      if (!period) {
        reply.code(400).send({
          error: { code: "period_required", message: "period is required" },
        });
        return;
      }

      const instruction = await prepareBasSettlementInstruction(
        orgIdHeader,
        period,
      );

      reply.code(201).send({
        orgId: orgIdHeader,
        period,
        instruction,
      });
    },
  );

  // Fetch a prepared settlement by id (stub)
  app.get(
    "/settlements/bas/:id",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id?: string };
      const id = params.id;
      if (!id) {
        reply.code(400).send({
          error: { code: "id_required", message: "id path parameter is required" },
        });
        return;
      }

      // In a real implementation this would hit the settlement store.
      reply.code(200).send({
        id,
        status: "prepared",
      });
    },
  );

  // Mark settlement sent to ATO (stub)
  app.post(
    "/settlements/bas/:id/send",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id?: string };
      const id = params.id;
      if (!id) {
        reply.code(400).send({
          error: { code: "id_required", message: "id path parameter is required" },
        });
        return;
      }

      const result = await markBasSettlementSent(id);
      reply.code(200).send(result);
    },
  );

  // Mark settlement acknowledged by ATO (stub)
  app.post(
    "/settlements/bas/:id/ack",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id?: string };
      const id = params.id;
      if (!id) {
        reply.code(400).send({
          error: { code: "id_required", message: "id path parameter is required" },
        });
        return;
      }

      const result = await markBasSettlementAcknowledged(id);
      reply.code(200).send(result);
    },
  );

  // Mark settlement failed (stub)
  app.post(
    "/settlements/bas/:id/fail",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id?: string };
      const id = params.id;
      if (!id) {
        reply.code(400).send({
          error: { code: "id_required", message: "id path parameter is required" },
        });
        return;
      }

      const body = (request.body ?? {}) as FailBody;
      const reason = (body.reason ?? "").trim();
      if (!reason) {
        reply.code(400).send({
          error: { code: "reason_required", message: "reason is required" },
        });
        return;
      }

      const result = await markBasSettlementFailed(id, reason);
      reply.code(200).send(result);
    },
  );
}
