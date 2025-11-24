import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import {
  createPaymentPlanRequest,
  listPaymentPlans,
  updatePaymentPlanStatus,
} from "@apgms/shared";
import { authGuard } from "../auth.js";
import { buildPaymentPlanNarrative } from "@apgms/shared";

const PaymentPlanBodySchema = z.object({
  basCycleId: z.string().min(1),
  reason: z.string().min(10),
  details: z.record(z.string(), z.unknown()).optional(),
});

const PaymentPlanStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type AuthenticatedRequest = FastifyRequest & { user?: { orgId?: string; sub?: string } };

export async function registerPaymentPlanRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authGuard);

  app.get("/payment-plans", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const orgId = request.user?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    if (!request.user?.role) {
      reply.code(403).send({ error: "forbidden_role" });
      return;
    }
    const plans = await listPaymentPlans(orgId);
    reply.send({ plans });
  });

  app.post("/payment-plans", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const orgId = request.user?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    if (!request.user?.role) {
      reply.code(403).send({ error: "forbidden_role" });
      return;
    }
    const parsed = PaymentPlanBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({
        error: {
          code: "invalid_body",
          message: "Validation failed",
          details: parsed.error.flatten(),
        },
      });
      return;
    }
    const payload = parsed.data;
    const plan = await createPaymentPlanRequest({
      orgId,
      basCycleId: payload.basCycleId,
      reason: payload.reason,
      details: payload.details,
    });
    reply.code(201).send({ plan });
  });

  app.post("/payment-plans/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = PaymentPlanStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({
        error: {
          code: "invalid_body",
          message: "Validation failed",
          details: parsed.error.flatten(),
        },
      });
      return;
    }
    const payload = parsed.data;
    try {
      const updated = await updatePaymentPlanStatus(
        (request.params as { id: string }).id,
        payload.status,
        payload.metadata,
      );
      reply.send({ updated });
    } catch (error) {
      reply.code(404).send({ error: "plan_not_found" });
    }
  });

  app.get("/payment-plans/:id/summary", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;
    if (!user?.orgId) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }
    if (!user.role) {
      reply.code(403).send({ error: "forbidden_role" });
      return;
    }
    const id = (request.params as { id: string }).id;
    const plan = await prisma.paymentPlanRequest.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        basCycleId: true,
        reason: true,
        status: true,
        detailsJson: true,
        requestedAt: true,
      },
    });
    if (!plan) {
      reply.code(404).send({ error: "plan_not_found" });
      return;
    }
    if (plan.orgId !== user.orgId) {
      reply.code(403).send({ error: "forbidden_wrong_org" });
      return;
    }
    const narrative = buildPaymentPlanNarrative(plan);
    reply.send({ plan, summary: narrative });
  });
}
