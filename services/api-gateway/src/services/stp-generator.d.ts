export type PayEventEmployee = {
    taxFileNumber: string;
    grossCents: number;
    paygWithheldCents: number;
};
export type StpPayEvent = {
    payerAbn: string;
    payPeriodStart: string;
    payPeriodEnd: string;
    payDate: string;
    employees: PayEventEmployee[];
};
/**
 * Generates a minimal STP-style payload for PAYGW.
 * This is intentionally not the full ATO XML schema â€“ it's a logical representation.
 */
export declare function generateStpPayload(event: StpPayEvent): unknown;
//# sourceMappingURL=stp-generator.d.ts.map