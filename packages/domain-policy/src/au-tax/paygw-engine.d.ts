import { type PayPeriod, type PaygwConfig, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
export interface PaygwCalculationInput {
    jurisdiction: JurisdictionCode;
    paymentDate: Date;
    grossCents: number;
    payPeriod: PayPeriod;
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
 * PAYGW engine that applies simple base + marginal formulas per bracket.
 */
export declare class PaygwEngine {
    private readonly repo;
    constructor(repo: TaxConfigRepository);
    calculate(input: PaygwCalculationInput): Promise<PaygwCalculationResult>;
    private findBracketIndex;
}
