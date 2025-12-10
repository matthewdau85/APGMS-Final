/**
 * Simple PAYGW and GST calculation helpers.
 * These are deliberately opinionated and rely on injectable tax tables so that
 * downstream services can swap in updated formulas without code changes.
 */
export type PaygwBracketSet = ReadonlyArray<PaygwBracket>;
export interface GstInput {
    readonly amount: number;
    readonly rate?: number;
}
export interface GstResult {
    readonly gstPortion: number;
    readonly netOfGst: number;
}
export type PayPeriod = "weekly" | "fortnightly" | "monthly" | "quarterly";
export interface Schedule1Row {
    readonly weeklyLessThan: number | null;
    readonly a: number | null;
    readonly b: number | null;
}
export type Schedule1ScaleKey = "scale1NoTaxFreeThreshold" | "scale2WithTaxFreeThreshold" | "scale3ForeignResident";
export interface PaygwBracket {
    readonly threshold: number;
    readonly rate: number;
    readonly base: number;
}
export interface PaygwInput {
    readonly taxableIncome: number;
    readonly brackets: PaygwBracketSet;
}
export interface PaygwResult {
    readonly withheld: number;
    readonly effectiveRate: number;
}
export declare function calculateGst({ amount, rate }: GstInput): GstResult;
export declare function calculatePaygw(input: PaygwInput): PaygwResult;
export interface WorkingHolidayBracket {
    readonly upTo?: number;
    readonly over?: number;
    readonly base: number;
    readonly marginalRate: number;
}
export interface WorkingHolidayInput {
    readonly taxableIncome: number;
    readonly brackets: ReadonlyArray<WorkingHolidayBracket>;
}
export declare function calculateWorkingHolidayMakerWithholding({ taxableIncome, brackets, }: WorkingHolidayInput): PaygwResult;
export interface StslThreshold {
    readonly min: number;
    readonly max?: number;
    readonly repayment: {
        type: "none";
    } | {
        type: "marginal_over_min";
        centsPerDollar: number;
        minRef: number;
        base: number;
    } | {
        type: "base_plus_marginal";
        centsPerDollar: number;
        minRef: number;
        base: number;
    } | {
        type: "percent_of_total_income";
        rate: number;
    };
}
export interface StslInput {
    readonly taxableIncome: number;
    readonly thresholds: ReadonlyArray<StslThreshold>;
}
export declare function calculateStslRepayment({ taxableIncome, thresholds }: StslInput): number;
export interface Schedule1Input {
    readonly gross: number;
    readonly payPeriod: PayPeriod;
    readonly scale: Schedule1ScaleKey;
    readonly coefficients: Record<Schedule1ScaleKey, ReadonlyArray<Schedule1Row>>;
}
export declare function calculateSchedule1Withholding({ gross, payPeriod, scale, coefficients, }: Schedule1Input): PaygwResult;
//# sourceMappingURL=index.d.ts.map