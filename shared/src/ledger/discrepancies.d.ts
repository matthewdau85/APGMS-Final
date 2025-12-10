import { Decimal } from "@prisma/client/runtime/library";
export declare function recordDiscrepancy(params: {
    orgId: string;
    taxType: string;
    eventId: string;
    expectedAmount: number | string | Decimal;
    actualAmount: number | string | Decimal;
    reason: string;
}): Promise<any>;
export declare function fetchRecentDiscrepancies(orgId: string): Promise<any>;
//# sourceMappingURL=discrepancies.d.ts.map