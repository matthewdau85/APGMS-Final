// packages/domain-policy/src/au-tax/paygw-rounding.ts
//
// Deterministic rounding helpers used to derive per-period cents from an annual
// amount in cents.
//
// Important distinction (ATO-grade):
// - ATO PAYG withholding *reporting* is generally rounded to whole dollars
//   (50 cents rounds up) per the relevant schedules.
// - This helper is about deterministic allocation and rounding in cents.
//   Use policy.precision=0 to round the per-period amount to whole dollars (in cents).

import type { PayPeriod } from "./types.js";

export interface RoundingPolicy {
  // precision in decimal places of dollars:
  // - 2 => cents
  // - 0 => whole dollars
  precision: 0 | 2;
  method: "round_half_even" | "round_half_up";
}

export const DEFAULT_ROUNDING_POLICY: RoundingPolicy = {
  precision: 2,
  method: "round_half_even",
};

const PERIOD_DENOMINATORS: Record<PayPeriod, number> = {
  WEEKLY: 52,
  FORTNIGHTLY: 26,
  MONTHLY: 12,
  ANNUAL: 1,
};

function roundDivideBigInt(
  dividend: bigint,
  divisor: bigint,
  policy: RoundingPolicy,
): bigint {
  if (divisor <= 0n) throw new Error("Invalid divisor");

  const quotient = dividend / divisor;
  const remainder = dividend % divisor;

  const absRemainder = remainder < 0n ? -remainder : remainder;
  const absDivisor = divisor < 0n ? -divisor : divisor;

  const double = absRemainder * 2n;

  let adjustment = 0n;

  if (double > absDivisor) {
    adjustment = 1n;
  } else if (double === absDivisor) {
    if (policy.method === "round_half_up") {
      adjustment = 1n;
    } else if (policy.method === "round_half_even") {
      // If quotient is odd, round away from zero; if even, round toward zero.
      if (quotient % 2n !== 0n) adjustment = 1n;
    }
  }

  // Preserve sign for negative dividends
  const signedAdjustment = dividend < 0n ? -adjustment : adjustment;
  return quotient + signedAdjustment;
}

function roundToWholeDollarsCents(
  cents: bigint,
  policy: RoundingPolicy,
): bigint {
  // Convert cents -> dollars (as integer) with rounding, then back to cents.
  const dollars = roundDivideBigInt(cents, 100n, policy);
  return dollars * 100n;
}

export function computeWithholding(args: {
  annualAmountCents: number;
  payPeriod: PayPeriod;
  policy?: RoundingPolicy;
}): number {
  const policy = args.policy ?? DEFAULT_ROUNDING_POLICY;

  const denom = PERIOD_DENOMINATORS[args.payPeriod];
  if (!denom) throw new Error(`Unknown pay period: ${String(args.payPeriod)}`);

  const annual = BigInt(args.annualAmountCents);
  let perPeriodCents = roundDivideBigInt(annual, BigInt(denom), policy);

  if (policy.precision === 0) {
    perPeriodCents = roundToWholeDollarsCents(perPeriodCents, policy);
  }

  const out = Number(perPeriodCents);
  if (!Number.isFinite(out)) throw new Error("Withholding overflow");
  return out;
}
