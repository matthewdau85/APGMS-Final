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
export declare function buildPaymentPlanNarrative(plan: PaymentPlanSummaryInput): string;
//# sourceMappingURL=payment-plan-summary.d.ts.map