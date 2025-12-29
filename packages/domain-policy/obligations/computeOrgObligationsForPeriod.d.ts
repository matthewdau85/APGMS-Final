// packages/domain-policy/src/obligations/computeOrgObligationsForPeriod.ts

import { prisma as defaultPrisma } from "@apgms/shared/db.js";

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
 * IMPORTANT:
 * - Supports dependency injection for tests/services via `db` param.
 * - Defaults to the shared Prisma client for backwards compatibility.
 */
export async function computeOrgObligationsForPeriod(
  orgId: string,
  period: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any = defaultPrisma,
): Promise<PeriodObligations> {
  const [payrollItems, gstTransactions] = await Promise.all([
    db.payrollItem.findMany({
      where: { orgId, period },
      select: { orgId: true, period: true, paygwCents: true },
    }),
    db.gstTransaction.findMany({
      where: { orgId, period },
      select: { orgId: true, period: true, gstCents: true },
    }),
  ]);

  const payrollDtos: PayrollItemDTO[] = payrollItems.map((p: any) => ({
    orgId: p.orgId,
    period: p.period,
    paygwCents: Number(p.paygwCents ?? 0),
  }));

  const gstDtos: GstTransactionDTO[] = gstTransactions.map((g: any) => ({
    orgId: g.orgId,
    period: g.period,
    gstCents: Number(g.gstCents ?? 0),
  }));

  return computePeriodObligationsFromDtos(payrollDtos, gstDtos);
}
