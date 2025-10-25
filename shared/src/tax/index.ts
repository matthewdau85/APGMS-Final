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

export type Schedule1ScaleKey =
  | "scale1NoTaxFreeThreshold"
  | "scale2WithTaxFreeThreshold"
  | "scale3ForeignResident";

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

export function calculateGst({ amount, rate = 0.1 }: GstInput): GstResult {
  if (amount <= 0 || rate <= 0) {
    return { gstPortion: 0, netOfGst: amount };
  }
  const divisor = 1 + rate;
  const netOfGst = amount / divisor;
  const gstPortion = amount - netOfGst;
  return {
    gstPortion: roundCurrency(gstPortion),
    netOfGst: roundCurrency(netOfGst),
  };
}

export function calculatePaygw(input: PaygwInput): PaygwResult {
  if (input.taxableIncome <= 0 || input.brackets.length === 0) {
    return { withheld: 0, effectiveRate: 0 };
  }

  const sorted = [...input.brackets].sort((a, b) => a.threshold - b.threshold);
  let withheld = 0;

  for (const bracket of sorted) {
    withheld = Math.max(0, bracket.base + bracket.rate * input.taxableIncome);
    if (input.taxableIncome <= bracket.threshold) {
      break;
    }
  }

  const effectiveRate = Math.min(1, withheld / input.taxableIncome);
  return {
    withheld: roundCurrency(withheld),
    effectiveRate,
  };
}

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

export function calculateWorkingHolidayMakerWithholding({
  taxableIncome,
  brackets,
}: WorkingHolidayInput): PaygwResult {
  if (taxableIncome <= 0) {
    return { withheld: 0, effectiveRate: 0 };
  }

  const matched = brackets.find((bracket) => {
    const lowerBound = bracket.over ?? 0;
    const upperBound = bracket.upTo ?? Number.POSITIVE_INFINITY;
    return taxableIncome > lowerBound && taxableIncome <= upperBound;
  }) ?? brackets[brackets.length - 1];

  const withheld = matched.base + matched.marginalRate * (taxableIncome - (matched.over ?? 0));
  return {
    withheld: roundCurrency(withheld),
    effectiveRate: Math.min(1, withheld / taxableIncome),
  };
}

export interface StslThreshold {
  readonly min: number;
  readonly max?: number;
  readonly repayment:
    | { type: "none" }
    | { type: "marginal_over_min"; centsPerDollar: number; minRef: number; base: number }
    | { type: "base_plus_marginal"; centsPerDollar: number; minRef: number; base: number }
    | { type: "percent_of_total_income"; rate: number };
}

export interface StslInput {
  readonly taxableIncome: number;
  readonly thresholds: ReadonlyArray<StslThreshold>;
}

export function calculateStslRepayment({ taxableIncome, thresholds }: StslInput): number {
  const match =
    thresholds.find((entry) => {
      const withinMin = taxableIncome >= entry.min;
      const withinMax = entry.max === undefined ? true : taxableIncome <= entry.max;
      return withinMin && withinMax;
    }) ?? thresholds[thresholds.length - 1];

  switch (match.repayment.type) {
    case "none":
      return 0;
    case "marginal_over_min": {
      const over = Math.max(0, taxableIncome - match.repayment.minRef);
      return roundCurrency(match.repayment.base + over * match.repayment.centsPerDollar);
    }
    case "base_plus_marginal": {
      const over = Math.max(0, taxableIncome - match.repayment.minRef);
      return roundCurrency(match.repayment.base + over * match.repayment.centsPerDollar);
    }
    case "percent_of_total_income":
  return roundCurrency(taxableIncome * match.repayment.rate);
  default:
    return 0;
  }
}

export interface Schedule1Input {
  readonly gross: number;
  readonly payPeriod: PayPeriod;
  readonly scale: Schedule1ScaleKey;
  readonly coefficients: Record<Schedule1ScaleKey, ReadonlyArray<Schedule1Row>>;
}

export function calculateSchedule1Withholding({
  gross,
  payPeriod,
  scale,
  coefficients,
}: Schedule1Input): PaygwResult {
  if (gross <= 0) {
    return { withheld: 0, effectiveRate: 0 };
  }

  const rows = coefficients[scale] ?? [];
  if (rows.length === 0) {
    return { withheld: 0, effectiveRate: 0 };
  }

  const weeklyGross = toWeekly(gross, payPeriod);
  const x = Math.floor(weeklyGross) + 0.99;
  const row =
    rows.find((candidate) => {
      if (candidate.weeklyLessThan === null) {
        return true;
      }
      return weeklyGross < candidate.weeklyLessThan;
    }) ?? rows[rows.length - 1];

  if (row.a === null || row.b === null) {
    return { withheld: 0, effectiveRate: 0 };
  }

  const weeklyWithholding = Math.max(0, row.a * x - row.b);
  const periodWithholding = fromWeekly(weeklyWithholding, payPeriod);
  const rounded = roundWholeDollar(periodWithholding);
  return {
    withheld: rounded,
    effectiveRate: Math.min(1, rounded / gross),
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundWholeDollar(value: number): number {
  return Math.floor(value + 0.5);
}

function toWeekly(gross: number, period: PayPeriod): number {
  switch (period) {
    case "weekly":
      return gross;
    case "fortnightly":
      return gross / 2;
    case "monthly":
      return (gross * 3) / 13;
    case "quarterly":
      return gross / 13;
    default:
      return gross;
  }
}

function fromWeekly(weeklyAmount: number, period: PayPeriod): number {
  switch (period) {
    case "weekly":
      return weeklyAmount;
    case "fortnightly":
      return weeklyAmount * 2;
    case "monthly":
      return (weeklyAmount * 13) / 3;
    case "quarterly":
      return weeklyAmount * 13;
    default:
      return weeklyAmount;
  }
}
