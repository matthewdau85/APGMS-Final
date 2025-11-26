import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  finalizeBasLodgment,
  recordBasLodgment,
  createTransferInstruction,
  createPaymentPlanRequest,
  verifyObligations,
} from "@apgms/shared";
import { metrics } from "../observability/metrics.js";
import { assertOrgAccess } from "../utils/orgScope.js";
import { recordCriticalAuditLog } from "../lib/audit.js";

const TAX_TYPES: Array<{ key: string; label: string }> = [
  { key: "PAYGW", label: "PAYGW obligations" },
  { key: "GST", label: "GST obligations" },
];

type LodgmentRequest = FastifyRequest<{
  Querystring: { basCycleId?: string };
  Body?: { initiatedBy?: string };
}>;

function ensureUserOrg(request: FastifyRequest, reply: FastifyReply): string | null {
  const user = (request as any).user as { orgId?: string } | undefined;
  if (!user?.orgId) {
    reply.code(401).send({ error: "unauthorized", message: "Authentication required" });
    return null;
  }
  if (!assertOrgAccess(request, reply, user.orgId)) {
    return null;
  }
  return user.orgId;
}

type VerificationEntry = {
  balance: string;
  pending: string;
  shortfall: string | null;
};

export async function registerBasRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/bas/lodgment",
    async (request: LodgmentRequest, reply: FastifyReply): Promise<void> => {
      const orgId = ensureUserOrg(request, reply);
      if (!orgId) return;

      const basCycleId = String(request.query.basCycleId ?? "manual");
      const lodgment = await recordBasLodgment({
        orgId,
        initiatedBy: request.body?.initiatedBy,
        taxTypes: TAX_TYPES.map((type) => type.key),
        status: "in_progress",
      });

      const verification: Record<string, VerificationEntry> = {};
      let overallStatus: "success" | "failed" = "success";
      const shortfalls: string[] = [];

      for (const type of TAX_TYPES) {
        const result = await verifyObligations(orgId, type.key);
        verification[type.key] = {
          balance: result.balance.toString(),
          pending: result.pending.toString(),
          shortfall: result.shortfall?.toString() ?? null,
        };

        if (result.shortfall && result.shortfall.gt(0)) {
          overallStatus = "failed";
          shortfalls.push(
            `${type.key} shortfall ${result.shortfall.toString()}`,
          );
        }
      }

      if (overallStatus === "success") {
        for (const type of TAX_TYPES) {
          const entry = verification[type.key];

          await createTransferInstruction({
            orgId,
            taxType: type.key,
            basId: lodgment.id,
            amount: entry.pending,
            destination: `gov:${type.key.toLowerCase()}`,
          });

          metrics.transferInstructionTotal.inc({
            tax_type: type.key,
            status: "queued",
          });
        }
      }

      if (overallStatus === "failed") {
        const reason =
          shortfalls.length > 0
            ? shortfalls.join("; ")
            : "Verification failed";

        await createPaymentPlanRequest({
          orgId,
          basCycleId,
          reason,
          details: {
            shortfalls,
            verification,
          },
        });

        metrics.paymentPlanRequestsTotal.inc({ status: "created" });
      }

      await finalizeBasLodgment(lodgment.id, verification, overallStatus);
      metrics.basLodgmentsTotal.inc({ status: overallStatus });

      await recordCriticalAuditLog({
        orgId,
        actorId: request.user?.sub ?? "system",
        action: "bas.lodgment",
        metadata: {
          basCycleId,
          status: overallStatus,
          shortfalls,
        },
      });

      reply.send({
        lodgmentId: lodgment.id,
        status: overallStatus,
        verification,
      });
    },
  );
}
