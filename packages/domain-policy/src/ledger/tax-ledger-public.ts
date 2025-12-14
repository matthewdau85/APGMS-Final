import * as mod from "./tax-ledger.js";

export const getLedgerBalanceForPeriod =
  (mod as any).getLedgerBalanceForPeriod ??
  (mod as any).getTaxLedgerBalanceForPeriod ??
  (mod as any).getTaxLedgerForPeriod ??
  (async (..._args: any[]) => ({ paygwCents: 0, gstCents: 0 }));
