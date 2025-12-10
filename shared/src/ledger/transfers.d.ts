import { Decimal } from "@prisma/client/runtime/library";
export type TransferStatus = "queued" | "sent" | "failed";
export declare function createTransferInstruction(params: {
    orgId: string;
    taxType: string;
    basId: string;
    amount: number | string | Decimal;
    destination: string;
}): Promise<any>;
export declare function markTransferStatus(id: string, status: TransferStatus): Promise<any>;
//# sourceMappingURL=transfers.d.ts.map