export interface TransferRequest {
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    reference: string;
}
export interface TransferResult {
    id: string;
    status: "PENDING" | "SETTLED" | "FAILED";
    providerCode?: string;
}
export interface BankingProvider {
    transfer(req: TransferRequest): Promise<TransferResult>;
}
