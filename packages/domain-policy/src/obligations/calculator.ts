// packages/domain-policy/src/obligations/calculator.ts

import type {
  PeriodObligations,
  PayrollItemDTO,
  GstTransactionDTO,
} from "./types.js";

/**
 * Pure, deterministic calculator.
 * No Prisma, no I/O – just adds numbers.
 */
export function computePeriodObligationsFromDtos(
  payrollItems: PayrollItemDTO[],
  gstTransactions: GstTransactionDTO[],
): PeriodObligations {
  const paygwCents = payrollItems.reduce(
    (sum, item) => sum + (item.paygwCents ?? 0),
    0,
  );

  const gstCents = gstTransactions.reduce(
    (sum, tx) => sum + (tx.gstCents ?? 0),
    0,
  );

  const breakdown = [];

  if (paygwCents !== 0) {
    breakdown.push({
      source: "PAYROLL" as const,
      amountCents: paygwCents,
    });
  }

  if (gstCents !== 0) {
    breakdown.push({
      source: "POS" as const,
      amountCents: gstCents,
    });
  }

  return {
    paygwCents,
    gstCents,
    breakdown,
  };
}
