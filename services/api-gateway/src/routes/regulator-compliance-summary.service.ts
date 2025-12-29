// services/api-gateway/src/routes/regulator-compliance-summary.service.ts

import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger";
import type { FastifyInstance } from "fastify";

type BreakdownEntry = { source: "PAYROLL" | "POS"; amountCents: number };

type PeriodObligations = {
  paygwCents: number;
  gstCents: number;
  breakdown: BreakdownEntry[];
};

type LedgerTotals = {
  PAYGW: number;
  GST: number;
};

export type RegulatorComplianceSummary = {
  orgId: string;
  period: string;
  obligations: PeriodObligations;
  ledger: LedgerTotals;
  basCoverageRatio: number;
  risk: {
    riskBand: "LOW" | "MEDIUM" | "HIGH";
    reasons: string[];
  };
};

export type ComputeRegulatorComplianceSummaryArgs = {
  db: FastifyInstance["db"];
  orgId: string;
  period: string;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function computeRisk(basCoverageRatio: number, obligationsTotal: number) {
  const reasons: string[] = [];
  if (obligationsTotal <= 0) {
    return { riskBand: "LOW" as const, reasons: ["No obligations for period."] };
  }

  if (basCoverageRatio >= 0.9) {
    reasons.push("Coverage ratio at or above 0.90.");
    return { riskBand: "LOW" as const, reasons };
  }

  if (basCoverageRatio >= 0.7) {
    reasons.push("Coverage ratio between 0.70 and 0.90.");
    reasons.push("Monitor cashflow and ensure captures reconcile to obligations.");
    return { riskBand: "MEDIUM" as const, reasons };
  }

  reasons.push("Coverage ratio below 0.70.");
  reasons.push("Likely shortfall risk if remittance is due before next capture cycle.");
  return { riskBand: "HIGH" as const, reasons };
}

export async function computeRegulatorComplianceSummary(
  args: ComputeRegulatorComplianceSummaryArgs,
): Promise<RegulatorComplianceSummary> {
  const { db, orgId, period } = args;

  const [payrollItems, gstTransactions] = await Promise.all([
    (db as any).payrollItem.findMany({
      where: { orgId, period },
      select: { paygwCents: true },
    }),
    (db as any).gstTransaction.findMany({
      where: { orgId, period },
      select: { gstCents: true },
    }),
  ]);

  const paygwCents = (payrollItems || []).reduce((s: number, r: any) => s + Number(r.paygwCents ?? 0), 0);
  const gstCents = (gstTransactions || []).reduce((s: number, r: any) => s + Number(r.gstCents ?? 0), 0);

  const breakdown: BreakdownEntry[] = [];
  if (paygwCents > 0) breakdown.push({ source: "PAYROLL", amountCents: paygwCents });
  if (gstCents > 0) breakdown.push({ source: "POS", amountCents: gstCents });

  const obligations: PeriodObligations = { paygwCents, gstCents, breakdown };

  const ledgerBalances = (await getLedgerBalanceForPeriod(orgId, period)) as any;
  const ledger: LedgerTotals = {
    PAYGW: Number(ledgerBalances?.PAYGW ?? 0),
    GST: Number(ledgerBalances?.GST ?? 0),
  };

  const obligationsTotal = obligations.paygwCents + obligations.gstCents;
  const ledgerTotal = ledger.PAYGW + ledger.GST;

  const basCoverageRatio = obligationsTotal <= 0 ? 1 : clamp01(ledgerTotal / obligationsTotal);
  const risk = computeRisk(basCoverageRatio, obligationsTotal);

  return { orgId, period, obligations, ledger, basCoverageRatio, risk };
}
