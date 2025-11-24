import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db.js";
export async function recordDiscrepancy(params) {
    const expected = new Decimal(params.expectedAmount);
    const actual = new Decimal(params.actualAmount);
    return prisma.discrepancyAlert.create({
        data: {
            orgId: params.orgId,
            taxType: params.taxType,
            eventId: params.eventId,
            expectedAmount: expected,
            actualAmount: actual,
            reason: params.reason,
        },
    });
}
export async function fetchRecentDiscrepancies(orgId) {
    return prisma.discrepancyAlert.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
}
