import { prisma } from "../db.js";
export async function logGovernmentSubmission(params) {
    return prisma.governmentSubmission.create({
        data: {
            orgId: params.orgId,
            method: params.method,
            payload: params.payload,
            response: params.response ? params.response : null,
            status: params.status ?? "pending",
        },
    });
}
