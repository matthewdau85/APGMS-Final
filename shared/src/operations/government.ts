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
      response: params.response ? (params.response as InputJsonValue) : null,
      status: params.status ?? "pending",
    },
  });
}
