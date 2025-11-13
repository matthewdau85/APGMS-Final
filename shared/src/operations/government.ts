import { Prisma } from "@prisma/client";

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
      payload: params.payload as Prisma.InputJsonValue,
      response: params.response ? (params.response as Prisma.InputJsonValue) : Prisma.JsonNull,
      status: params.status ?? "pending",
    },
  });
}
