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
    parameterSetId: string;
    bracketIndex: number;
    configUsed?: PaygwConfig;
}
/**
 * Basic PAYGW engine that uses ATO "a * X − b" style brackets.
 * Keeps behaviour simple and deterministic for now.
 */
export declare class PaygwEngine {
    private readonly repo;
    constructor(repo: TaxConfigRepository);
    calculate(input: PaygwCalculationInput): Promise<PaygwCalculationResult>;
    private toWeekly;
    private fromWeekly;
    private findBracket;
}
