import type { JsonValue } from "@prisma/client/runtime/library";

export type PaymentPlanSummaryInput = {
  id: string;
  orgId: string;
  basCycleId: string;
  reason: string;
  status: string;
  requestedAt: Date;
  detailsJson: JsonValue;
};

const describeDetails = (details: JsonValue): string => {
  if (details === null) {
    return "no details provided";
  }
  if (typeof details === "string" || typeof details === "number" || typeof details === "boolean") {
    return details.toString();
  }
  try {
    return JSON.stringify(details);
  } catch {
    return "complex details";
  }
};

export function buildPaymentPlanNarrative(plan: PaymentPlanSummaryInput): string {
  const formattedDate =
    plan.requestedAt instanceof Date ? plan.requestedAt.toISOString() : String(plan.requestedAt);
  const detailsDescription = describeDetails(plan.detailsJson);
  return `Payment plan ${plan.id} for cycle ${plan.basCycleId} is ${plan.status}. Reason: ${plan.reason}. Details: ${detailsDescription}. Requested at ${formattedDate}; org ${plan.orgId}.`;
}
