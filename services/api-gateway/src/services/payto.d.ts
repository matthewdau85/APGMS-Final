import type { FastifyBaseLogger } from "fastify";
export type PayToCreateMandateInput = {
    orgId: string;
    bsb: string;
    accountNumber: string;
    accountName: string;
};
export type PayToMandate = {
    mandateId: string;
    status: "PENDING" | "ACTIVE" | "FAILED";
};
export interface PayToProvider {
    createMandate(input: PayToCreateMandateInput): Promise<PayToMandate>;
    cancelMandate(mandateId: string): Promise<void>;
}
export declare function initPayToProviders(log: FastifyBaseLogger): Record<string, PayToProvider>;
export declare function getPayToProvider(bankCode: "cba" | "nab" | "anz"): PayToProvider;
//# sourceMappingURL=payto.d.ts.map