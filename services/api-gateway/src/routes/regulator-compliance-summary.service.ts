import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

type BreakdownEntry = {
  source: "PAYROLL" | "POS";
  amountCents: number;
};

type PeriodObligations = {
  paygwCents: number;
  gstCents: number;
  breakdown: BreakdownEntry[];
};

type RegulatorComplianceSummary = {
  orgId: string;
  period: string;
  obligations: PeriodObligations;
  basCoverageRatio: number;
  risk: {
    riskBand: RiskBand;
    reasons: string[];
  };
};

export type ComputeSummaryArgs = {
  // Use a loose DB type because this must work for both:
  // - Prisma client
  // - your createInMemoryDb() proxy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  orgId: string;
  period: string;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function computeRiskBand(coverageRatio: number, obligationsTotalCents: number): { band: RiskBand; reasons: string[] } {
  const reasons: string[] = [];

  if (obligationsTotalCents <= 0) {
    return { band: "LOW", reasons: ["No obligations due for the period."] };
  }

  if (coverageRatio >= 0.9) {
    reasons.push("Coverage ratio >= 90%.");
    return { band: "LOW", reasons };
  }

  if (coverageRatio >= 0.5) {
    reasons.push("Coverage ratio between 50% and 90%.");
    return { band: "MEDIUM", reasons };
  }

  reasons.push("Coverage ratio below 50%.");
  return { band: "HIGH", reasons };
}

/**
 * Compute regulator summary using the SAME db instance the app uses (app.db).
 * This is the critical alignment needed for your e2e test.
 */
export async function computeRegulatorComplianceSummary(
  args: ComputeSummaryArgs,
): Promise<RegulatorComplianceSummary> {
  const { db, orgId, period } = args;

  // Fetch obligations from the provided db (NOT from shared prisma).
  const [payrollItems, gstTransactions] = await Promise.all([
    db.payrollItem.findMany({
      where: { orgId, period },
    }),
    db.gstTransaction.findMany({
      where: { orgId, period },
    }),
  ]);

  const paygwCents = (payrollItems ?? []).reduce(
    (sum: number, p: any) => sum + Number(p?.paygwCents ?? 0),
    0,
  );

  const gstCents = (gstTransactions ?? []).reduce(
    (sum: number, g: any) => sum + Number(g?.gstCents ?? 0),
    0,
  );

  const breakdown: BreakdownEntry[] = [];
  if (paygwCents !== 0) breakdown.push({ source: "PAYROLL", amountCents: paygwCents });
  if (gstCents !== 0) breakdown.push({ source: "POS", amountCents: gstCents });

  const obligations: PeriodObligations = {
    paygwCents,
    gstCents,
    breakdown,
  };

  // Ledger totals (mocked in your test)
  const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);

  const paidCents =
    Number((ledgerTotals as any)?.PAYGW ?? 0) + Number((ledgerTotals as any)?.GST ?? 0);

  const dueCents = paygwCents + gstCents;

  const basCoverageRatio = dueCents > 0 ? clamp01(paidCents / dueCents) : 1;

  const { band, reasons } = computeRiskBand(basCoverageRatio, dueCents);

  return {
    orgId,
    period,
    obligations,
    basCoverageRatio,
    risk: {
      riskBand: band,
      reasons,
    },
  };
}
