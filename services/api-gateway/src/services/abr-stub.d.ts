export type AbnTfnLookupInput = {
    abn?: string;
    tfn?: string;
};
export type AbnTfnLookupResult = {
    abn?: string;
    tfn?: string;
    legalName: string;
    obligations: Array<"GST" | "PAYGW" | "PAYGI">;
};
/**
 * Placeholder ABN/TFN validator.
 * Replace later with real ATO/ABR integration.
 */
export declare function validateAbnOrTfnStub(input: AbnTfnLookupInput): Promise<AbnTfnLookupResult>;
//# sourceMappingURL=abr-stub.d.ts.map