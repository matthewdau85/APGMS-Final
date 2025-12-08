// packages/domain-policy/src/obligations/computeOrgObligationsForPeriod.ts

import { prisma } from "@apgms/shared/db.js";

import type {
  PeriodObligations,
  PayrollItemDTO,
  GstTransactionDTO,
} from "./types.js";
import { computePeriodObligationsFromDtos } from "./calculator.js";

/**
 * Adapter: fetches raw data for an org + period and feeds it into the
 * pure calculator (computePeriodObligationsFromDtos).
 *
 * Now filters by both orgId and period so obligations are truly per-period.
 */
export async function computeOrgObligationsForPeriod(
  orgId: string,
  period: string,
): Promise<PeriodObligations> {
  const [payrollItems, gstTransactions] = await Promise.all([
    prisma.payrollItem.findMany({
      where: {
        orgId,
        period,
      },
      select: {
        orgId: true,
        period: true,
        paygwCents: true,
      },
    }),
    prisma.gstTransaction.findMany({
      where: {
        orgId,
        period,
      },
      select: {
        orgId: true,
        period: true,
        gstCents: true,
      },
    }),
  ]);

  const payrollDtos: PayrollItemDTO[] = payrollItems.map((p) => ({
    orgId: p.orgId,
    period: p.period,
    paygwCents: Number(p.paygwCents ?? 0),
  }));

  const gstDtos: GstTransactionDTO[] = gstTransactions.map((g) => ({
    orgId: g.orgId,
    period: g.period,
    gstCents: Number(g.gstCents ?? 0),
  }));

  // This is effectively your summariseObligations({ payroll, gstTx })
  return computePeriodObligationsFromDtos(payrollDtos, gstDtos);
}
