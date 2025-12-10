import { Decimal } from "@prisma/client/runtime/library";
export type ObligationStatus = "pending" | "verified" | "settled";
export declare function recordObligation(params: {
    orgId: string;
    taxType: string;
    eventId: string;
    amount: number | string | Decimal;
    status?: ObligationStatus;
}): Promise<any>;
export declare function aggregateObligations(orgId: string, taxType: string): Promise<any>;
export declare function markObligationsStatus(orgId: string, taxType: string, status: ObligationStatus): Promise<any>;
export declare function verifyObligations(orgId: string, taxType: string): Promise<{
    pending: any;
    balance: any;
    shortfall: Decimal | null;
}>;
//# sourceMappingURL=obligations.d.ts.map