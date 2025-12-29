// services/api-gateway/src/routes/integration-events.ts
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { z } from "zod";

import {
  aggregateObligations,
  analyzeIntegrationAnomaly,
  depositToOneWayAccount,
  fetchRecentDiscrepancies,
  listPaymentPlans,
  markIntegrationEventProcessed,
  recordDiscrepancy,
  recordIntegrationEvent,
  recordObligation,
  type TaxObligation,
  verifyObligations,
} from "@apgms/shared";
import { metrics } from "../observability/metrics.js";

const IntegrationEventSchema = z.object({
  orgId: z.string().min(1),
  amount: z
    .union([z.number(), z.string()])
    .transform((value) =>
      typeof value === "number" ? value.toString() : value
    )
    .refine((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0;
    }, "amount must be a positive number"),
  source: z.string().trim().min(1).optional().default("integration"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type IntegrationPayload = z.infer<typeof IntegrationEventSchema>;

function extractExpectedAmount(
  metadata?: Record<string, unknown>,
): number | null {
  if (!metadata) return null;
  const value = (metadata as { expectedAmount?: unknown }).expectedAmount;
  if (value == null) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

async function handleIntegrationEvent(
  request: FastifyRequest,
  reply: FastifyReply,
  taxType: TaxObligation,
): Promise<void> {
  let payload: IntegrationPayload;
  try {
    payload = IntegrationEventSchema.parse(request.body);
  } catch {
    reply.code(400).send({ error: "invalid_body" });
    return;
  }

  const stopTimer = metrics.integrationEventDuration.startTimer({
    tax_type: taxType,
  });

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

    const expectedAmount = extractExpectedAmount(
      payload.metadata as Record<string, unknown> | undefined,
    );
    const actualAmount = Number(payload.amount);

    if (expectedAmount != null && expectedAmount > actualAmount) {
      await recordDiscrepancy({
        orgId: payload.orgId,
        taxType,
        eventId: event.id,
        expectedAmount: expectedAmount.toString(),
        actualAmount: payload.amount,
        reason: "Secured amount below expected obligation",
      });
      metrics.integrationDiscrepanciesTotal.inc({
        tax_type: taxType,
        severity: "high",
      });
    }

    await markIntegrationEventProcessed(event.id);
    metrics.integrationEventsTotal.inc({
      tax_type: taxType,
      status: "success",
    });
    stopTimer();

    reply.code(201).send({ eventId: event.id });
  } catch (error) {
    metrics.integrationEventsTotal.inc({
      tax_type: taxType,
      status: "failed",
    });
    stopTimer();
    throw error;
  }
}

export async function registerIntegrationEventRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/integrations/discrepancies",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const orgId = String(
        (request.query as { orgId?: string }).orgId ?? "",
      ).trim();

      if (!orgId) {
        reply.code(400).send({ error: "orgId_is_required" });
        return;
      }

      const alerts = await fetchRecentDiscrepancies(orgId);
      reply.send({ discrepancies: alerts });
    },
  );

  app.get(
    "/integrations/obligations",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const query = request.query as { orgId?: string; taxType?: string };
      const orgId = String(query.orgId ?? "").trim();
      const taxType = String(query.taxType ?? "PAYGW").trim();

      if (!orgId) {
        reply.code(400).send({ error: "orgId_is_required" });
        return;
      }

      const total = await aggregateObligations(orgId, taxType);
      metrics.obligationsTotal.set(
        { tax_type: taxType },
        Number(total.toString()),
      );

      reply.send({
        orgId,
        taxType,
        pendingAmount: total.toString(),
      });
    },
  );

  app.get(
    "/integrations/anomaly",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const query = request.query as { orgId?: string; taxType?: string };
      const orgId = String(query.orgId ?? "").trim();
      const taxType = String(query.taxType ?? "PAYGW").trim();

      if (!orgId) {
        reply.code(400).send({ error: "orgId_is_required" });
        return;
      }

      const analysis = await analyzeIntegrationAnomaly(orgId, taxType);

      metrics.integrationAnomalyScore.set(
        { tax_type: taxType, severity: analysis.severity },
        Number(analysis.score.toFixed(4)),
      );

      reply.send({
        orgId,
        taxType,
        severity: analysis.severity,
        score: Number(analysis.score.toFixed(4)),
        narrative: analysis.narrative,
        explanation: analysis.explanation,
      });
    },
  );

  app.get(
    "/integrations/compliance-report",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const query = request.query as { orgId?: string; taxType?: string };
      const orgId = String(query.orgId ?? "").trim();
      const taxType = String(query.taxType ?? "PAYGW").trim();

      if (!orgId) {
        reply.code(400).send({ error: "orgId_is_required" });
        return;
      }

      const [obligationsTotal, discrepancies, anomaly] = await Promise.all([
        aggregateObligations(orgId, taxType),
        fetchRecentDiscrepancies(orgId),
        analyzeIntegrationAnomaly(orgId, taxType),
      ]);

      const plans = await listPaymentPlans(orgId);

      reply.send({
        orgId,
        taxType,
        pendingObligations: obligationsTotal.toString(),
        discrepancies: discrepancies.map((alert: any) => ({
          eventId: alert.eventId,
          reason: alert.reason,
          shortfall: alert.expectedAmount
            .minus(alert.actualAmount)
            .toString(),
          createdAt: alert.createdAt,
        })),
        anomaly,
        paymentPlans: plans.map((plan: any) => ({
          id: plan.id,
          basCycleId: plan.basCycleId,
          status: plan.status,
          reason: plan.reason,
          requestedAt: plan.requestedAt,
        })),
        generatedAt: new Date().toISOString(),
      });
    },
  );

  app.post(
    "/integrations/payroll",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await handleIntegrationEvent(request, reply, "PAYGW");
    },
  );

  app.post(
    "/integrations/pos",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await handleIntegrationEvent(request, reply, "GST");
    },
  );
}
