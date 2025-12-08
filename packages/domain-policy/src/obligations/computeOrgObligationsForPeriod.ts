// packages/domain-policy/src/obligations/computeOrgObligationsForPeriod.ts

import { prisma } from "@apgms/shared/db.js";
import type {
  PeriodObligations,
  PayrollItemDTO,
  GstTransactionDTO,
} from "./types";
import { computePeriodObligationsFromDtos } from "./calculator";

/**
 * Adapter: fetches raw data for an org + period and feeds it into the
 * pure calculator (computePeriodObligationsFromDtos).
 *
 * Right now we only filter by orgId and inject the period into DTOs.
 * Once you have a native period column on payroll/gst tables, you can
 * uncomment/tighten the where-clauses.
 */
export async function computeOrgObligationsForPeriod(
  orgId: string,
  period: string,
): Promise<PeriodObligations> {
  const [payrollItems, gstTransactions] = await Promise.all([
    prisma.payrollItem.findMany({
      where: {
        orgId,
        // period,
      },
      select: {
        orgId: true,
        paygwCents: true,
      },
    }),
    prisma.gstTransaction.findMany({
      where: {
        orgId,
        // period,
      },
      select: {
        orgId: true,
        gstCents: true,
      },
    }),
  ]);

  const payrollDtos: PayrollItemDTO[] = payrollItems.map((p) => ({
    orgId: p.orgId,
    period, // until you have a native period field
    paygwCents: Number(p.paygwCents ?? 0),
  }));

  const gstDtos: GstTransactionDTO[] = gstTransactions.map((g) => ({
    orgId: g.orgId,
    period,
    gstCents: Number(g.gstCents ?? 0),
  }));

  // This is effectively your “summariseObligations({ payroll, gstTx })”
  return computePeriodObligationsFromDtos(payrollDtos, gstDtos);
}
