import { Decimal } from "@prisma/client/runtime/library";
export type TaxObligation = "PAYGW" | "GST";
export declare function getOrCreateOneWayAccount(params: {
    orgId: string;
    taxType: string;
}): Promise<any>;
export declare function depositToOneWayAccount(params: {
    orgId: string;
    taxType: string;
    amount: number | string | Decimal;
}): Promise<any>;
export declare function fetchOneWayAccount(params: {
    orgId: string;
    taxType: string;
}): Promise<any>;
//# sourceMappingURL=one-way-account.d.ts.map