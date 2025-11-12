import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  aggregateObligations,
  depositToOneWayAccount,
  fetchRecentDiscrepancies,
  markIntegrationEventProcessed,
  recordDiscrepancy,
  recordIntegrationEvent,
  recordObligation,
  TaxObligation,
  verifyObligations,
} from "@apgms/shared";
import { parseWithSchema } from "../lib/validation.js";
import { metrics } from "../observability/metrics.js";

const IntegrationEventSchema = z.object({
  orgId: z.string().min(1),
  amount: z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === "number" ? value.toString() : value))
    .refine((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0;
    }, "amount must be a positive number"),
  source: z.string().trim().min(1).optional().default("integration"),
  metadata: z.record(z.unknown()).optional(),
});

type IntegrationPayload = z.infer<typeof IntegrationEventSchema>;

function extractExpectedAmount(metadata?: Record<string, unknown>) {
  if (!metadata) return null;
  const value = metadata.expectedAmount;
  if (value == null) return null;
  try {
    const decimal = new Prisma.Decimal(value as string | number);
    return decimal.gt(0) ? decimal : null;
  } catch {
    return null;
  }
}

async function handleIntegrationEvent(
  request: FastifyRequest,
  reply: FastifyReply,
  taxType: TaxObligation,
) {
  const payload = parseWithSchema(IntegrationEventSchema, request.body);
  const stopTimer = metrics.integrationEventDuration.startTimer({ tax_type: taxType });
  const event = await recordIntegrationEvent({
    orgId: payload.orgId,
    taxType,
    source: payload.source,
    amount: payload.amount,
    metadata: payload.metadata,
  });
  try {
    await depositToOneWayAccount({
      orgId: payload.orgId,
      taxType,
      amount: payload.amount,
    });
    await recordObligation({
      orgId: payload.orgId,
      taxType,
      eventId: event.id,
      amount: payload.amount,
    });
    const verification = await verifyObligations(payload.orgId, taxType);
    if (verification.shortfall?.greaterThan(0)) {
      await recordDiscrepancy({
        orgId: payload.orgId,
        taxType,
        eventId: event.id,
        expectedAmount: verification.pending.toString(),
        actualAmount: verification.balance.toString(),
        reason: "Secured balance below total pending obligations",
      });
      metrics.integrationDiscrepanciesTotal.inc({
        tax_type: taxType,
        severity: "high",
      });
    }

    const expectedAmount = extractExpectedAmount(payload.metadata);
    if (expectedAmount && expectedAmount.gt(new Prisma.Decimal(payload.amount))) {
      await recordDiscrepancy({
        orgId: payload.orgId,
        taxType,
        eventId: event.id,
        expectedAmount,
        actualAmount: payload.amount,
        reason: "Secured amount below expected obligation",
      });
      metrics.integrationDiscrepanciesTotal.inc({
        tax_type: taxType,
        severity: "high",
      });
    }

    await markIntegrationEventProcessed(event.id);
    metrics.integrationEventsTotal.inc({ tax_type: taxType, status: "success" });
    stopTimer({ status: "success" });
    reply.code(201).send({ eventId: event.id });
  } catch (error) {
    metrics.integrationEventsTotal.inc({ tax_type: taxType, status: "failed" });
    stopTimer({ status: "failed" });
    throw error;
  }
}

export async function registerIntegrationEventRoutes(app: FastifyInstance) {
  app.get("/integrations/discrepancies", async (request, reply) => {
    const orgId = String((request.query as { orgId?: string }).orgId ?? "").trim();
    if (!orgId) {
      reply.code(400).send({ error: "orgId_is_required" });
      return;
    }
    const alerts = await fetchRecentDiscrepancies(orgId);
    reply.send({ discrepancies: alerts });
  });

  app.get("/integrations/obligations", async (request, reply) => {
    const query = request.query as { orgId?: string; taxType?: string };
    const orgId = String(query.orgId ?? "").trim();
    const taxType = String(query.taxType ?? "PAYGW").trim();
    if (!orgId) {
      reply.code(400).send({ error: "orgId_is_required" });
      return;
    }
    const total = await aggregateObligations(orgId, taxType);
    metrics.obligationsTotal.set({ tax_type: taxType }, Number(total.toString()));
    reply.send({ orgId, taxType, pendingAmount: total.toString() });
  });

  app.post("/integrations/payroll", async (request, reply) => {
    await handleIntegrationEvent(request, reply, "PAYGW");
  });

  app.post("/integrations/pos", async (request, reply) => {
    await handleIntegrationEvent(request, reply, "GST");
  });
}
