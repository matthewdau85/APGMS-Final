// shared/src/ledger/payment-plan.ts
import { InputJsonValue } from "@prisma/client/runtime/library";

import { prisma } from "../db.js";

export type PaymentPlanStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export async function createPaymentPlanRequest(params: {
  orgId: string;
  basCycleId: string;
  reason: string;
  details?: Record<string, unknown>;
}) {
  // detailsJson is a required Json column – use {} when there are no details
  const payload = (params.details ?? {}) as InputJsonValue;

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
      // Only overwrite detailsJson when metadata is provided
      detailsJson: metadata ? (metadata as InputJsonValue) : undefined,
    },
  });
}
