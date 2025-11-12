import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { depositToOneWayAccount, markIntegrationEventProcessed, recordIntegrationEvent, TaxObligation } from "@apgms/shared";
import { parseWithSchema } from "../lib/validation.js";

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

async function handleIntegrationEvent(
  request: FastifyRequest,
  reply: FastifyReply,
  taxType: TaxObligation,
) {
  const payload = parseWithSchema(IntegrationEventSchema, request.body);
  const event = await recordIntegrationEvent({
    orgId: payload.orgId,
    taxType,
    source: payload.source,
    amount: payload.amount,
    metadata: payload.metadata,
  });
  await depositToOneWayAccount({
    orgId: payload.orgId,
    taxType,
    amount: payload.amount,
  });
  await markIntegrationEventProcessed(event.id);
  reply.code(201).send({ eventId: event.id });
}

export async function registerIntegrationEventRoutes(app: FastifyInstance) {
  app.post("/integrations/payroll", async (request, reply) => {
    await handleIntegrationEvent(request, reply, "PAYGW");
  });

  app.post("/integrations/pos", async (request, reply) => {
    await handleIntegrationEvent(request, reply, "GST");
  });
}
