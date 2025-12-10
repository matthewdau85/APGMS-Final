import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db.js";
const ALLOWED_TAX_TYPES = ["PAYGW", "GST"];
function ensureTaxType(value) {
    if (!ALLOWED_TAX_TYPES.includes(value)) {
        throw new Error(`Unsupported tax type: ${value}`);
    }
}
export async function getOrCreateOneWayAccount(params) {
    ensureTaxType(params.taxType);
    const account = await prisma.oneWayAccount.upsert({
        where: {
            orgId_taxType: {
                orgId: params.orgId,
                taxType: params.taxType,
            },
        },
        create: {
            orgId: params.orgId,
            taxType: params.taxType,
        },
        update: {},
    });
    return account;
}
export async function depositToOneWayAccount(params) {
    ensureTaxType(params.taxType);
    const amountDecimal = new Decimal(params.amount);
    const account = await getOrCreateOneWayAccount(params);
    const updated = await prisma.oneWayAccount.update({
        where: { id: account.id },
        data: {
            balance: {
                increment: amountDecimal,
            },
            lastDepositAt: new Date(),
        },
    });
    return updated;
}
export async function fetchOneWayAccount(params) {
    ensureTaxType(params.taxType);
    return prisma.oneWayAccount.findUnique({
        where: {
            orgId_taxType: {
                orgId: params.orgId,
                taxType: params.taxType,
            },
        },
    });
}
//# sourceMappingURL=one-way-account.js.map