// packages/domain-policy/src/obligations/computeOrgObligationsForPeriod.ts

import { prisma } from "@apgms/shared/db.js";

import {
  computePeriodObligationsFromDtos,
} from "./calculator.js";

import type {
  PeriodObligations,
  PayrollItemDTO,
  GstTransactionDTO,
} from "./types.js";

/**
 * Adapter that pulls data from Prisma, converts to DTOs,
 * and delegates to the pure calculator.
 *
 * NOTE: Period filtering is not implemented yet – everything is by orgId only.
 * Once you add a proper period field or mapping to dates, you can refine the
 * Prisma where clauses.
 */
export async function computeOrgObligationsForPeriod(
  orgId: string,
  period: string,
): Promise<PeriodObligations> {
  // TODO: Filter on period once the model supports it
  const [payrollItems, gstTransactions] = await Promise.all([
    prisma.payrollItem.findMany({
      where: {
        orgId,
        // When period is modelled, wire it like:
        // period: period,
      },
      select: {
        orgId: true,
        grossCents: true, // not strictly needed, but here if you need it later
        paygwCents: true,
      },
    }),
    prisma.gstTransaction.findMany({
      where: {
        orgId,
        // period: period,
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

  return computePeriodObligationsFromDtos(payrollDtos, gstDtos);
}
