// services/api-gateway/src/routes/bas-settlement.ts

import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth.js";
import { AppError } from "../errors.js";
import {
  prepareBasSettlementInstruction,
  markBasSettlementSent,
  markBasSettlementAck,
  markBasSettlementFailed,
} from "@apgms/domain-policy/settlement/bas-settlement";

export async function registerBasSettlementRoutes(app: FastifyInstance) {
  // Existing “prepare” endpoint
  app.post(
    "/settlements/bas/prepare",
    {
      preHandler: [authGuard],
      schema: {
        body: {
          type: "object",
          required: ["period"],
          properties: {
            period: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = request.headers["x-org-id"];
      const period = (request.body as { period: string }).period;

      if (!orgId || typeof orgId !== "string") {
        throw new AppError("missing_org", 400, "x-org-id header is required");
      }

      if (!/^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/.test(period)) {
        throw new AppError(
          "invalid_period",
          400,
          "Period must be YYYY-Qn or YYYY-MM",
        );
      }

      const record = await prepareBasSettlementInstruction(orgId, period);

      request.log.info({ settlementId: record.id }, "Prepared BAS settlement");

      return reply.code(201).send({
        instructionId: record.id,
        payload: record.payloadJson,
      });
    },
  );

  // Mark as SENT – called when you’ve pushed to PayTo
  app.post(
    "/settlements/bas/:id/sent",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const orgId = request.headers["x-org-id"];
      const id = (request.params as { id: string }).id;

      if (!orgId || typeof orgId !== "string") {
        throw new AppError("missing_org", 400, "x-org-id header is required");
      }

      const record = await markBasSettlementSent(id);
      return reply.code(200).send({ instructionId: record.id, status: record.status });
    },
  );

  // ACK callback – called by future PayTo gateway or your internal worker
  app.post(
    "/settlements/bas/:id/ack",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const orgId = request.headers["x-org-id"];
      const id = (request.params as { id: string }).id;

      if (!orgId || typeof orgId !== "string") {
        throw new AppError("missing_org", 400, "x-org-id header is required");
      }

      const record = await markBasSettlementAck(id);
      return reply.code(200).send({ instructionId: record.id, status: record.status });
    },
  );

  // FAILED callback – body carries reason
  app.post(
    "/settlements/bas/:id/failed",
    {
      preHandler: [authGuard],
      schema: {
        body: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = request.headers["x-org-id"];
      const id = (request.params as { id: string }).id;
      const { reason } = request.body as { reason: string };

      if (!orgId || typeof orgId !== "string") {
        throw new AppError("missing_org", 400, "x-org-id header is required");
      }

      const record = await markBasSettlementFailed(id, reason);
      return reply
        .code(200)
        .send({ instructionId: record.id, status: record.status });
    },
  );
}
