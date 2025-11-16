import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@apgms/shared/db.js";
import {
  createPaymentPlan,
  listPaymentPlanHistory,
  getPaymentPlan,
  updatePaymentPlanStatus,
} from "@apgms/payment-plans";

const createSchema = z.object({
  orgId: z.string(),
  basCycleId: z.string(),
  reason: z.string().min(10),
  weeklyAmount: z.number().positive(),
  startDate: z.string(),
  notes: z.string().optional(),
  installments: z.number().int().positive().optional(),
});

const statusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  metadata: z.record(z.unknown()).optional(),
});

export async function registerPaymentPlanRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const orgId = (request.query as { orgId?: string }).orgId;
    if (!orgId) {
      reply.code(400).send({ error: "orgId_required" });
      return;
    }
    const plans = await listPaymentPlanHistory(prisma, orgId);
    reply.send({ plans });
  });

  app.post("/", async (request, reply) => {
    const payload = createSchema.parse(request.body);
    const plan = await createPaymentPlan(prisma, payload, { paygwShortfall: 0, gstShortfall: 0 });
    reply.code(201).send({ plan });
  });

  app.get("/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const plan = await getPaymentPlan(prisma, id);
    if (!plan) {
      reply.code(404).send({ error: "plan_not_found" });
      return;
    }
    reply.send({ plan });
  });

  app.post("/:id/status", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const payload = statusSchema.parse(request.body);
    try {
      const updated = await updatePaymentPlanStatus(prisma, id, payload.status, payload.metadata);
      reply.send({ plan: updated });
    } catch (error) {
      request.log.error(error, "failed_to_update_plan_status");
      reply.code(404).send({ error: "plan_not_found" });
    }
  });
}
