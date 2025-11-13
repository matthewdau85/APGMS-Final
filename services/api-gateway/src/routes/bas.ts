import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { finalizeBasLodgment, recordBasLodgment, createTransferInstruction } from "@apgms/shared";
import { verifyObligations } from "@apgms/shared";
import { metrics } from "../observability/metrics.js";

const TAX_TYPES: Array<{ key: string; label: string }> = [
  { key: "PAYGW", label: "PAYGW obligations" },
  { key: "GST", label: "GST obligations" },
];

type LodgmentRequest = FastifyRequest<{
  Querystring: { orgId?: string };
  Body?: { initiatedBy?: string };
}>;

export async function registerBasRoutes(app: FastifyInstance) {
  app.post("/bas/lodgment", async (request: LodgmentRequest, reply: FastifyReply) => {
    const orgId = String(request.query.orgId ?? "").trim();
    if (!orgId) {
      reply.code(400).send({ error: "orgId is required" });
      return;
    }

    const lodgment = await recordBasLodgment({
      orgId,
      initiatedBy: request.body?.initiatedBy,
      taxTypes: TAX_TYPES.map((type) => type.key),
      status: "in_progress",
    });

    const verification: Record<string, unknown> = {};
    let overallStatus: "success" | "failed" = "success";

    for (const type of TAX_TYPES) {
      const result = await verifyObligations(orgId, type.key);
      verification[type.key] = {
        balance: result.balance.toString(),
        pending: result.pending.toString(),
        shortfall: result.shortfall?.toString() ?? null,
      };
      if (result.shortfall && result.shortfall.gt(0)) {
        overallStatus = "failed";
      }
    }

    if (overallStatus === "success") {
      for (const type of TAX_TYPES) {
        await createTransferInstruction({
          orgId,
          taxType: type.key,
          basId: lodgment.id,
          amount: verification[type.key as string].pending,
          destination: `gov:${type.key.toLowerCase()}`,
        });
        metrics.transferInstructionTotal.inc({ tax_type: type.key, status: "queued" });
      }
    }

    await finalizeBasLodgment(lodgment.id, verification, overallStatus);
    metrics.basLodgmentsTotal.inc({ status: overallStatus });

    reply.send({
      lodgmentId: lodgment.id,
      status: overallStatus,
      verification,
    });
  });
}
