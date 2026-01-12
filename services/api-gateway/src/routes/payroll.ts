import type { FastifyInstance } from "fastify";
import type { PayrollBatch } from "@apgms/domain-policy";
import { validateWithReply } from "../lib/validation.js";
import { PayrollBatchRequestSchema } from "@apgms/shared";

export async function registerPayrollRoutes(app: FastifyInstance) {
  app.post<{
    Params: { orgId: string };
    Body: Omit<PayrollBatch, "orgId">;
  }>("/orgs/:orgId/payroll/simulate", async (req, reply) => {
    const { orgId } = req.params;
    const payload = validateWithReply(PayrollBatchRequestSchema, req.body ?? {}, reply);
    if (!payload) return;

    const batch: PayrollBatch = {
      orgId,
      basPeriodId: payload.basPeriodId,
      lines: payload.lines,
    };

    const result = await app.services.paygwSettlement.settleBatch(batch);
    return reply.code(200).send(result);
  });
}
