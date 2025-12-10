import { prisma } from "../db.js";
export async function createPaymentPlanRequest(params) {
    // detailsJson is a required Json column – use {} when there are no details
    const payload = (params.details ?? {});
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
export async function listPaymentPlans(orgId) {
    return prisma.paymentPlanRequest.findMany({
        where: { orgId },
        orderBy: { requestedAt: "desc" },
        take: 50,
    });
}
export async function updatePaymentPlanStatus(id, status, metadata) {
    return prisma.paymentPlanRequest.update({
        where: { id },
        data: {
            status,
            // Only overwrite detailsJson when metadata is provided
            detailsJson: metadata ? metadata : undefined,
        },
    });
}
//# sourceMappingURL=payment-plan.js.map