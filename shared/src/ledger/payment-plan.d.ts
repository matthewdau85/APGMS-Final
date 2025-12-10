export type PaymentPlanStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export declare function createPaymentPlanRequest(params: {
    orgId: string;
    basCycleId: string;
    reason: string;
    details?: Record<string, unknown>;
}): Promise<any>;
export declare function listPaymentPlans(orgId: string): Promise<any>;
export declare function updatePaymentPlanStatus(id: string, status: PaymentPlanStatus, metadata?: Record<string, unknown>): Promise<any>;
//# sourceMappingURL=payment-plan.d.ts.map