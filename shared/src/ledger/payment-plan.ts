import { Decimal, InputJsonValue } from "@prisma/client/runtime/library";

import { prisma } from "../db.js";

export type PaymentPlanStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";

export async function createPaymentPlanRequest(params: {
  orgId: string;
  basCycleId: string;
  reason: string;
  details?: Record<string, unknown>;
}) {
  const payload = params.details ? (params.details as InputJsonValue) : Prisma.JsonNull;
  return prisma.paymentPlanRequest.create({
    data: {
      orgId: params.orgId,
      basCycleId: params.basCycleId,
      reason: params.reason,
      detailsJson: payload,
      status: "SUBMITTED",
    },
  });
}

export async function listPaymentPlans(orgId: string) {
  return prisma.paymentPlanRequest.findMany({
    where: { orgId },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
}

export async function updatePaymentPlanStatus(
  id: string,
  status: PaymentPlanStatus,
  metadata?: Record<string, unknown>,
) {
  return prisma.paymentPlanRequest.update({
    where: { id },
    data: {
      status,
      detailsJson: metadata
        ? (metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });
}
