import { type PayPeriod, type PaygwConfig, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
export interface PaygwCalculationInput {
    jurisdiction: JurisdictionCode;
    payPeriod: PayPeriod;
    paymentDate: Date;
    grossCents: number;
    flags?: Record<string, unknown>;
}
export interface PaygwCalculationResult {
    withholdingCents: number;
    withheldCents: number;
    bracketIndex: number;
    parameterSetId: string;
    configUsed: PaygwConfig;
}
/**
 * Basic PAYGW engine that uses simple thresholded brackets with a base amount
 * plus marginal rates.
 */
export declare class PaygwEngine {
    private readonly repo;
    constructor(repo: TaxConfigRepository);
    calculate(input: PaygwCalculationInput): Promise<PaygwCalculationResult>;
    private findBracket;
}
