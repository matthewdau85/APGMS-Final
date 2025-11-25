import type { FastifyInstance } from "fastify";
import type { GstBatch, PosTransaction } from "@apgms/domain-policy";

export async function registerGstRoutes(app: FastifyInstance) {
  app.post<{
    Params: { orgId: string };
    Body: { transactions: Omit<PosTransaction, "orgId">[] };
  }>("/orgs/:orgId/pos/transactions", async (req, reply) => {
    const { orgId } = req.params;
    const batch: GstBatch = {
      orgId,
      transactions: req.body.transactions.map(tx => ({ ...tx, orgId })),
    };

    const result = await app.services.gstSettlement.settleBatch(batch);
    return reply.code(200).send(result);
  });
}
