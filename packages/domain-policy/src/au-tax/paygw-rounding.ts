import type { PayPeriod } from "./types.js";

export interface RoundingPolicy {
  precision: number;
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

export function computeWithholding(input: {
  annualAmountCents: number;
  payPeriod: PayPeriod;
  roundingPolicy?: RoundingPolicy;
}): number {
  const { annualAmountCents, payPeriod, roundingPolicy = DEFAULT_ROUNDING_POLICY } = input;
  const denominator = PERIOD_DENOMINATORS[payPeriod];
  if (!denominator) {
    throw new Error(`Unsupported pay period ${payPeriod}`);
  }
  if (annualAmountCents <= 0) {
    return 0;
  }
  const scaled = roundRational(BigInt(annualAmountCents), denominator, roundingPolicy);
  return Number(scaled);
}

function roundRational(
  numerator: bigint,
  denominator: number,
  policy: RoundingPolicy,
): bigint {
  const scaleExponent = Math.max(0, policy.precision - 2);
  const scale = BigInt(10) ** BigInt(scaleExponent);
  const divisor = BigInt(denominator);
  const scaledNumerator = numerator * scale;
  const quotient = scaledNumerator / divisor;
  const remainder = scaledNumerator % divisor;
  const double = remainder * 2n;
  let adjustment = 0n;
  if (double > divisor) {
    adjustment = 1n;
  } else if (double === divisor) {
    if (policy.method === "round_half_even") {
      if (quotient % 2n !== 0n) {
        adjustment = 1n;
      }
    } else if (policy.method === "round_half_up") {
      adjustment = 1n;
    }
  }
  return quotient + adjustment;
}
