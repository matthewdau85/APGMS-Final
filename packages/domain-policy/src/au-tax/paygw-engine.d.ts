import { type PayPeriod, type PaygwConfig, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
export interface PaygwCalculationInput {
    orgId: string;
    jurisdiction: JurisdictionCode;
    payPeriod: PayPeriod;
    /** Gross income for the pay period, expressed in cents. */
    grossCents: number;
    /** Payment date for the pay run. */
    paymentDate: Date;
    /** Optional flags from upstream payroll calculations. */
    flags?: Record<string, unknown>;
}
export interface PaygwCalculationResult {
    withholdingCents: number;
    /**
     * Index of the bracket used from the configured PAYGW schedule.
     */
    bracketIndex: number;
    /** Parameter set ID used for the calculation (from config meta). */
    parameterSetId: string;
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
    private normalizePeriod;
    private toWeekly;
    private fromWeekly;
    private findBracket;
}
