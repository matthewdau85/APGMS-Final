import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db.js";
export async function createTransferInstruction(params) {
    const amountDecimal = new Decimal(params.amount);
    return prisma.transferInstruction.create({
        data: {
            orgId: params.orgId,
            taxType: params.taxType,
            basId: params.basId,
            amount: amountDecimal,
            destination: params.destination,
        },
    });
}
export async function markTransferStatus(id, status) {
    return prisma.transferInstruction.update({
        where: { id },
        data: {
            status,
        },
    });
}
//# sourceMappingURL=transfers.js.map