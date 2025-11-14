import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { markTransferStatus } from "@apgms/shared";
import { metrics } from "../observability/metrics.js";
import { prisma } from "../db.js";
import { requireOrgContext } from "../utils/orgScope.js";
import { withIdempotency } from "../lib/idempotency.js";
import { recordCriticalAuditLog } from "../lib/audit.js";

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

    const ctx = requireOrgContext(request, reply);
    if (!ctx) return;

    try {
      await withIdempotency(
        request,
        reply,
        {
          prisma,
          orgId: ctx.orgId,
          actorId: ctx.actorId,
          requestPayload: payload,
        },
        async () => {
          await markTransferStatus(payload.instructionId, "sent");
          await recordCriticalAuditLog({
            orgId: ctx.orgId,
            actorId: ctx.actorId,
            action: "bas.transfer",
            metadata: { instructionId: payload.instructionId },
          });
          metrics.transferExecutionTotal.inc({ status: "success" });
          reply.send({ instructionId: payload.instructionId, status: "sent" });
          return { statusCode: 200 };
        },
      );
    } catch (error) {
      metrics.transferExecutionTotal.inc({ status: "failed" });
      const message = error instanceof Error ? error.message : undefined;
      if (message?.includes("idempotent_replay")) {
        reply.code(409).send({ error: "transfer_conflict" });
      } else {
        reply.code(500).send({ error: "transfer_failed" });
      }
    }
  });
}
