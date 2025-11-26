import { type GstConfig, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
export interface GstCalculationInput {
    orgId: string;
    jurisdiction: JurisdictionCode;
    taxableSuppliesCents: number;
    gstFreeSuppliesCents: number;
    inputTaxCreditsCents: number;
    asOf: Date;
}
export interface GstCalculationResult {
    netPayableCents: number;
    configUsed?: GstConfig;
}
export declare class GstEngine {
    private readonly repo;
    constructor(repo: TaxConfigRepository);
    calculate(input: GstCalculationInput): Promise<GstCalculationResult>;
}
