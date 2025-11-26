import { type PayPeriod, type PaygwConfig, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
export interface PaygwCalculationInput {
    orgId: string;
    jurisdiction: JurisdictionCode;
    payPeriod: PayPeriod;
    grossIncomeCents: number;
    asOf: Date;
}
export interface PaygwCalculationResult {
    withheldCents: number;
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
