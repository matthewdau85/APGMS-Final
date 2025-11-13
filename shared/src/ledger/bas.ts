import { InputJsonValue } from "@prisma/client/runtime/library";

import { prisma } from "../db.js";

export type BasLodgmentStatus = "queued" | "in_progress" | "success" | "failed";

export async function recordBasLodgment(params: {
  orgId: string;
  initiatedBy?: string;
  taxTypes: string[];
  status?: BasLodgmentStatus;
  result?: Record<string, unknown>;
}) {
  return prisma.basLodgment.create({
    data: {
      orgId: params.orgId,
      initiatedBy: params.initiatedBy,
      taxTypes: params.taxTypes,
      status: params.status ?? "queued",
      result: params.result ? (params.result as InputJsonValue) : null,
    },
  });
}

export async function finalizeBasLodgment(id: string, result: Record<string, unknown>, status: BasLodgmentStatus) {
  return prisma.basLodgment.update({
    where: { id },
    data: {
      result: result as InputJsonValue,
      status,
      processedAt: new Date(),
    },
  });
}
