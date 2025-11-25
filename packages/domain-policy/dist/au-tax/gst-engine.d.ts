import type { BasPeriodId } from "./bas-types";
export interface GstConfig {
    rateMilli: number;
}
export interface PosTransaction {
    orgId: string;
    basPeriodId: BasPeriodId;
    txId: string;
    txDate: Date;
    grossCents: number;
    taxable: boolean;
}
export interface GstCalculationResult {
    txId: string;
    gstCents: number;
}
export declare class GstEngine {
    private readonly config;
    constructor(config: GstConfig);
    calculate(tx: PosTransaction): GstCalculationResult;
}
