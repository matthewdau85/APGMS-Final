import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authGuard } from "../auth.js";
import { publishStructuredEvent } from "../lib/event-publisher.js";

const complianceRoles = new Set(["finance", "admin"]);

const paymentPlanSchema = z.object({
  paymentPlanId: z.string().uuid().optional(),
  discrepancyId: z.string().uuid().optional(),
  arrangementType: z.string().min(1),
  status: z.string().min(1),
  totalOutstandingCents: z.number().int().optional(),
  installmentAmountCents: z.number().int().optional(),
  installmentFrequency: z.string().min(1).optional(),
  firstPaymentDue: z
    .preprocess((value) =>
      value === undefined || value === null || value === ""
        ? undefined
        : typeof value === "string" || value instanceof Date
          ? new Date(value)
          : value,
    z.date())
    .optional(),
  nextPaymentDue: z
    .preprocess((value) =>
      value === undefined || value === null || value === ""
        ? undefined
        : typeof value === "string" || value instanceof Date
          ? new Date(value)
          : value,
    z.date())
    .optional(),
  lastPaymentReceived: z
    .preprocess((value) =>
      value === undefined || value === null || value === ""
        ? undefined
        : typeof value === "string" || value instanceof Date
          ? new Date(value)
          : value,
    z.date())
    .optional(),
  missedInstallments: z.number().int().min(0).optional(),
  terms: z.record(z.string(), z.any()).optional(),
  notes: z.string().max(4000).optional(),
  source: z.string().min(1).default("api"),
  metadata: z.record(z.string(), z.any()).optional(),
});

function ensureComplianceRole(request: FastifyRequest, reply: FastifyReply): boolean {
  const user = (request as any).user as { role?: string } | undefined;
  if (!user?.role || !complianceRoles.has(user.role)) {
    void reply.code(403).send({ error: { code: "forbidden" } });
    return false;
  }
  return true;
}

export async function registerComplianceRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (scope) => {
    scope.addHook("onRequest", authGuard);

    scope.put("/compliance/payment-plan", async (request, reply) => {
      if (!ensureComplianceRole(request, reply)) {
        return;
      }

      const parsed = paymentPlanSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        void reply
          .code(400)
          .send({ error: { code: "invalid_body", details: parsed.error.flatten() } });
        return;
      }

      const payload = parsed.data;
      const user = (request as any).user as { sub: string; orgId: string; role: string };
      const paymentPlanId = payload.paymentPlanId ?? randomUUID();

      await publishStructuredEvent(
        app,
        "compliance.payment-plan",
        "compliance.payment_plan.updated",
        user.orgId,
        {
          schemaVersion: "2025-11-05",
          key: `plan:${paymentPlanId}`,
          dedupeKey: `${user.orgId}:plan:${paymentPlanId}`,
          paymentPlanId,
          discrepancyId: payload.discrepancyId ?? null,
          arrangementType: payload.arrangementType,
          status: payload.status,
          totalOutstandingCents: payload.totalOutstandingCents ?? null,
          installmentAmountCents: payload.installmentAmountCents ?? null,
          installmentFrequency: payload.installmentFrequency ?? null,
          firstPaymentDue: payload.firstPaymentDue?.toISOString() ?? null,
          nextPaymentDue: payload.nextPaymentDue?.toISOString() ?? null,
          lastPaymentReceived: payload.lastPaymentReceived?.toISOString() ?? null,
          missedInstallments: payload.missedInstallments ?? null,
          terms: payload.terms ?? {},
          notes: payload.notes ?? null,
          source: payload.source,
          metadata: payload.metadata ?? {},
          updatedBy: {
            userId: user.sub,
            role: user.role,
          },
        },
        request,
      );

      void reply.code(202).send({
        paymentPlanId,
        status: payload.status,
      });
    });
  });
}

export default registerComplianceRoutes;
