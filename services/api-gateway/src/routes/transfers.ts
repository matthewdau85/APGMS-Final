import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError, markTransferStatus } from "@apgms/shared";
import { metrics } from "../observability/metrics.js";
import { prisma } from "../db.js";
import { requireOrgContext } from "../utils/orgScope.js";
import { withIdempotency } from "../lib/idempotency.js";
import { recordCriticalAuditLog } from "../lib/audit.js";
import { parseWithSchema } from "../lib/validation.js";

const TransferRequestSchema = z.object({
  instructionId: z.string().min(1),
  mfaCode: z.string().min(4),
});

const ALLOWED_TRANSFER_ROLES = ["owner", "admin", "accountant"];

type TransferRouteDeps = {
  prisma: Pick<PrismaClient, "idempotencyEntry">;
  markTransferStatus: typeof markTransferStatus;
  recordCriticalAuditLog: typeof recordCriticalAuditLog;
};

export function createTransferRoutes(deps: TransferRouteDeps): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.post("/bas/transfer", async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = parseWithSchema(TransferRequestSchema, request.body);
      const expectedCode = process.env.BAS_MFA_CODE ?? "0000";
      if (payload.mfaCode !== expectedCode) {
        metrics.transferExecutionTotal.inc({ status: "failed" });
        reply.code(401).send({ error: "invalid_mfa" });
        return;
      }

      const ctx = requireOrgContext(request, reply);
      if (!ctx) return;
      if (!ALLOWED_TRANSFER_ROLES.includes(ctx.role)) {
        reply.code(403).send({ error: { code: "forbidden_role", message: "Insufficient role for transfers" } });
        return;
      }

      try {
        await withIdempotency(
          request,
          reply,
          {
            prisma: deps.prisma as any,
            orgId: ctx.orgId,
            actorId: ctx.actorId,
            requestPayload: payload,
            resource: "transfer",
          },
          async () => {
            await deps.markTransferStatus(payload.instructionId, "sent");
            await deps.recordCriticalAuditLog({
              orgId: ctx.orgId,
              actorId: ctx.actorId,
              action: "bas.transfer",
              metadata: { instructionId: payload.instructionId },
            });
            metrics.transferExecutionTotal.inc({ status: "success" });
            const body = { instructionId: payload.instructionId, status: "sent" };
            reply.code(200).send(body);
            return { statusCode: 200, resourceId: payload.instructionId, resource: "transfer", body };
          },
        );
      } catch (error) {
        metrics.transferExecutionTotal.inc({ status: "failed" });
        if (error instanceof AppError) throw error;
        reply.code(500).send({ error: "transfer_failed" });
      }
    });
  };
}

export async function registerTransferRoutes(app: FastifyInstance) {
  const plugin = createTransferRoutes({ prisma, markTransferStatus, recordCriticalAuditLog });
  await app.register(plugin);
}
