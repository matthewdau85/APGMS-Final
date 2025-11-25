import type { FastifyInstance } from "fastify";
import type { PayrollBatch } from "@apgms/domain-policy";

export async function registerPayrollRoutes(app: FastifyInstance) {
  app.post<{
    Params: { orgId: string };
    Body: Omit<PayrollBatch, "orgId">;
  }>("/orgs/:orgId/payroll/simulate", async (req, reply) => {
    const { orgId } = req.params;
    const batch: PayrollBatch = {
      orgId,
      basPeriodId: req.body.basPeriodId,
      lines: req.body.lines,
    };

    const result = await app.services.paygwSettlement.settleBatch(batch);
    return reply.code(200).send(result);
  });
}
