import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { publishOperationalEvent, operationalSubjects } from "../lib/events.js";
import { assertOrgAccess } from "../utils/orgScope.js";

const destinationSchema = z.object({
  type: z.string().min(1),
  reference: z.string().min(1),
  bankCode: z.string().optional(),
});

const disbursementSchema = z.object({
  orgId: z.string().min(1),
  paymentId: z.string().uuid().optional(),
  amountCents: z.number().int(),
  channel: z.string().min(1).default("manual"),
  destination: destinationSchema,
  narrative: z.string().max(512).optional(),
  metadata: z.record(z.any()).optional(),
  flagged: z.boolean().optional(),
  fraudReason: z.string().max(256).optional(),
  discrepancyEventId: z.string().uuid().optional(),
});

const FRAUD_ESCALATION_THRESHOLD = 250_000;

export const registerPaymentsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/payments/disburse", async (req, reply) => {
    const user = (req as any).user!;
    assertOrgAccess(req, reply, user.orgId);

    const parsed = disbursementSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;

    if (data.orgId !== user.orgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    const paymentId = data.paymentId ?? randomUUID();

    await publishOperationalEvent(app, {
      subject: operationalSubjects.payments.disbursementScheduled,
      eventType: "payments.disbursement.scheduled",
      orgId: data.orgId,
      key: paymentId,
      payload: {
        paymentId,
        amountCents: data.amountCents,
        channel: data.channel,
        destination: data.destination,
        narrative: data.narrative ?? null,
        metadata: data.metadata ?? {},
        flagged: data.flagged ?? false,
        requestedBy: user.sub,
      },
    }, req as any);

    if (data.flagged) {
      const severity = Math.abs(data.amountCents) >= FRAUD_ESCALATION_THRESHOLD ? "critical" : "high";
      await publishOperationalEvent(app, {
        subject: operationalSubjects.payments.fraudAlertRaised,
        eventType: "payments.fraud_alert.raised",
        orgId: data.orgId,
        key: paymentId,
        payload: {
          paymentId,
          discrepancyEventId: data.discrepancyEventId ?? null,
          amountCents: data.amountCents,
          channel: data.channel,
          destination: data.destination,
          reason: data.fraudReason ?? "flagged_by_operator",
          severity,
          status: "OPEN",
          flaggedBy: user.sub,
          metadata: data.metadata ?? {},
        },
      }, req as any);
    }

    reply.code(202).send({ status: "accepted", paymentId });
  });
};

export default registerPaymentsRoutes;
