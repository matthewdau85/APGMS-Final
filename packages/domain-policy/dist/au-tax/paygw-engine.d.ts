import { JurisdictionCode, TaxConfigRepository } from "./types";
export type PayPeriod = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual";
export interface PaygwCalculationInput {
    jurisdiction: JurisdictionCode;
    paymentDate: Date;
    grossCents: number;
    payPeriod: PayPeriod;
    flags?: Record<string, boolean | string | number | undefined>;
}
export interface PaygwCalculationResult {
    withholdingCents: number;
    parameterSetId: string;
    bracketIndex: number;
}
/**
 * AU PAYGW engine that is entirely driven by TaxParameterSet and
 * TaxRateSchedule rows in the database.
 *
 * No numeric rates or thresholds are hard-coded here.
 */
export declare class PaygwEngine {
    private readonly configRepo;
    constructor(configRepo: TaxConfigRepository);
    calculate(input: PaygwCalculationInput): Promise<PaygwCalculationResult>;
    private assertPaygwConfig;
    private findBracketIndex;
    private applyBracket;
}
