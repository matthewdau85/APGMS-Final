import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { markTransferStatus } from "@apgms/shared";
import { metrics } from "../observability/metrics.js";

const TransferRequestSchema = z.object({
  instructionId: z.string().min(1),
  mfaCode: z.string().min(4),
});

export async function registerTransferRoutes(app: FastifyInstance) {
  app.post("/bas/transfer", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = TransferRequestSchema.parse(request.body);
    const expectedCode = process.env.BAS_MFA_CODE ?? "0000";
    if (payload.mfaCode !== expectedCode) {
      metrics.transferExecutionTotal.inc({ status: "failed" });
      reply.code(401).send({ error: "invalid_mfa" });
      return;
    }

    try {
      await markTransferStatus(payload.instructionId, "sent");
      metrics.transferExecutionTotal.inc({ status: "success" });
      reply.send({ instructionId: payload.instructionId, status: "sent" });
    } catch (error) {
      metrics.transferExecutionTotal.inc({ status: "failed" });
      reply.code(500).send({ error: "transfer_failed" });
    }
  });
}
