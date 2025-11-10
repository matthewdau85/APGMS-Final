import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { parseWithSchema } from "../lib/validation.js";

const paymentPlanSchema = z.object({
  orgId: z.string().uuid(),
  paymentPlanId: z.string().uuid().optional(),
  discrepancyId: z.string().uuid().optional(),
  fraudAlertId: z.string().uuid().optional(),
  status: z.string().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  paymentFrequency: z.string().min(1),
  totalAmountCents: z.coerce.number().int().optional(),
  terms: z.record(z.string(), z.any()).optional(),
});

export async function registerPaymentsRoutes(app: FastifyInstance): Promise<void> {
  const guard = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) =>
      authenticateRequest(app, req, reply, roles);

  app.post(
    "/payments/plans",
    { preHandler: guard(["analyst", "admin"]) },
    async (request, reply) => {
      const body = parseWithSchema(paymentPlanSchema, request.body);
      const principalOrgId = request.principal?.orgId ?? request.user?.orgId;
      if (!principalOrgId) {
        request.log.error({ route: "/payments/plans" }, "missing_principal_org");
        reply.code(500).send({
          error: { code: "principal_missing", message: "Unable to resolve organisation" },
        });
        return;
      }
      if (body.orgId !== principalOrgId) {
        reply.code(403).send({
          error: { code: "forbidden_org_scope", message: "Organisation mismatch" },
        });
        return;
      }
      const paymentPlanId = body.paymentPlanId ?? randomUUID();
      const status = body.status ?? "draft";

      if (!request.publishDomainEvent) {
        app.log.warn({ route: "/payments/plans" }, "domain_event_publisher_missing");
      } else {
        await request.publishDomainEvent({
          subject: "payments.plan",
          eventType: "payments.plan.agreement-created",
          orgId: principalOrgId,
          key: paymentPlanId,
          payload: {
            paymentPlanId,
            discrepancyId: body.discrepancyId ?? null,
            fraudAlertId: body.fraudAlertId ?? null,
            status,
            startDate: body.startDate ?? null,
            endDate: body.endDate ?? null,
            paymentFrequency: body.paymentFrequency,
            totalAmountCents: body.totalAmountCents ?? null,
            terms: body.terms ?? null,
          },
          source: "services.api-gateway.payments",
        });
      }

      reply.code(202).send({ paymentPlanId, status, accepted: true });
    },
  );
}

