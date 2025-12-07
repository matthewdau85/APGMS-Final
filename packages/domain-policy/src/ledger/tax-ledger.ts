// packages/domain-policy/src/ledger/tax-ledger.ts

/**
 * Minimal domain contract for tax ledger totals.
 * Later we’ll back this with real TaxLedgerEntry queries.
 */
export interface LedgerTotals {
  PAYGW?: number;
  GST?: number;
}

/**
 * Placeholder implementation.
 *
 * In the full build this should:
 * - query TaxLedgerEntry grouped by category for the given org + period
 * - return sums for PAYGW and GST in cents
 *
 * For now we just return zeros so that:
 * - the route code compiles and runs
 * - tests can safely mock this module without resolution errors
 */
export async function getLedgerBalanceForPeriod(
  _orgId: string,
  _period: string
): Promise<LedgerTotals> {
  return {
    PAYGW: 0,
    GST: 0,
  };
}
