import type { PaymentPlanRequest } from "@prisma/client";

export function buildPaymentPlanNarrative(plan: Pick<PaymentPlanRequest, "reason" | "status" | "detailsJson" | "requestedAt">) {
  const details = plan.detailsJson ?? {};
  const shortfalls = Array.isArray(details.shortfalls) ? details.shortfalls.join(", ") : null;
  return [
    `Payment plan request submitted on ${new Date(plan.requestedAt).toISOString().split("T")[0]}.`,
    `Reason:${plan.reason ? ` ${plan.reason}` : " not provided"}.`,
    plan.status === "APPROVED"
      ? "The plan is approved; transfers can be scheduled per the agreed timeline."
      : plan.status === "REJECTED"
      ? "The plan is rejected; please submit additional documentation."
      : "The plan is awaiting review.",
    shortfalls ? `Shortfalls recorded: ${shortfalls}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
