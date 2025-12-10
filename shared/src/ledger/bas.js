import { prisma } from "../db.js";
export async function recordBasLodgment(params) {
    return prisma.basLodgment.create({
        data: {
            orgId: params.orgId,
            initiatedBy: params.initiatedBy,
            taxTypes: params.taxTypes,
            status: params.status ?? "queued",
            // Avoid raw null – let Prisma handle optional JSON via undefined
            result: params.result ? params.result : undefined,
        },
    });
}
export async function finalizeBasLodgment(id, result, status) {
    return prisma.basLodgment.update({
        where: { id },
        data: {
            result: result,
            status,
            processedAt: new Date(),
        },
    });
}
//# sourceMappingURL=bas.js.map