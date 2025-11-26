// shared/src/operations/government.ts
import { InputJsonValue } from "@prisma/client/runtime/library";

import { prisma } from "../db.js";

export async function logGovernmentSubmission(params: {
  orgId: string;
  method: string;
  payload: Record<string, unknown>;
  status?: string;
  response?: Record<string, unknown>;
}) {
  return prisma.governmentSubmission.create({
    data: {
      orgId: params.orgId,
      method: params.method,
      payload: params.payload as InputJsonValue,
      // Use undefined instead of raw null for optional JSON field
      response: params.response ? (params.response as InputJsonValue) : undefined,
      status: params.status ?? "pending",
    },
  });
}
