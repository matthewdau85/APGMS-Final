import { prisma } from "../db.js";
export async function logGovernmentSubmission(params) {
    return prisma.governmentSubmission.create({
        data: {
            orgId: params.orgId,
            method: params.method,
            payload: params.payload,
            // Use undefined instead of raw null for optional JSON field
            response: params.response ? params.response : undefined,
            status: params.status ?? "pending",
        },
    });
}
//# sourceMappingURL=government.js.map