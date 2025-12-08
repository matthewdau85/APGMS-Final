// packages/domain-policy/src/export/evidence.ts

import type { PeriodObligations } from "../obligations/types.js";
import { computeOrgObligationsForPeriod } from "../obligations/computeOrgObligationsForPeriod.js";
import type { LedgerTotals } from "../ledger/tax-ledger.js";
import { getLedgerBalanceForPeriod } from "../ledger/tax-ledger.js";

export interface BasEvidencePack {
  orgId: string;
  period: string;
  obligations: PeriodObligations;
  ledgerTotals: LedgerTotals;
}

/**
 * Build a BAS "evidence pack" combining:
 * - computed PAYGW/GST obligations for the period
 * - ledger totals for that same period
 */
export async function buildBasEvidencePack(
  orgId: string,
  period: string,
): Promise<BasEvidencePack> {
  const obligations = await computeOrgObligationsForPeriod(orgId, period);
  const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);

  return {
    orgId,
    period,
    obligations,
    ledgerTotals,
  };
}
