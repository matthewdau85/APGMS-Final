// packages/domain-policy/src/ledger/tax-ledger-public.ts

import { getLedgerBalanceForPeriod } from "./tax-ledger.js";
export type { LedgerTotals } from "./tax-ledger.js";

// Keep the named export (some code imports this directly)
export { getLedgerBalanceForPeriod };

// Keep the “Public” alias (your index.ts uses this)
export async function getLedgerBalanceForPeriodPublic(orgId: string, period: string) {
  return getLedgerBalanceForPeriod(orgId, period);
}
