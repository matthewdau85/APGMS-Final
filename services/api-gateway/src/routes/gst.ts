import type { FastifyInstance } from "fastify";
import type { GstBatch } from "@apgms/domain-policy";
import { z } from "zod";
import {
  OrgScopedParamsSchema,
  GstBatchRequestSchema,
  GstTransactionSchema,
} from "@apgms/shared";
import { validateWithReply } from "../lib/validation.js";

export async function registerGstRoutes(app: FastifyInstance) {
  app.post<{
    Params: { orgId: string };
    Body: { transactions: Omit<GstBatch["transactions"][number], "orgId">[] };
  }>("/orgs/:orgId/pos/transactions", async (req, reply) => {
    const params = validateWithReply(OrgScopedParamsSchema, req.params, reply);
    if (!params) return;

    const payload = validateWithReply(GstBatchRequestSchema, req.body ?? {}, reply);
    if (!payload) return;

    type GstTransaction = z.infer<typeof GstTransactionSchema>;

    const batch: GstBatch = {
      orgId: params.orgId,
      transactions: payload.transactions.map((tx: GstTransaction) => ({
        ...tx,
        orgId: params.orgId,
      })),
    };

    const result = await app.services.gstSettlement.settleBatch(batch);
    return reply.code(200).send(result);
  });
}
