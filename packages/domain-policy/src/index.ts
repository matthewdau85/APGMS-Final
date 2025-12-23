// packages/domain-policy/src/index.ts

// Obligations
export { computeOrgObligationsForPeriod } from "./obligations/computeOrgObligationsForPeriod.js";
export { computeObligations } from "./compute/computeObligations.js";

// Ledger
export { getLedgerBalanceForPeriod } from "./ledger/tax-ledger-public.js";
export {
  appendLedgerEntry,
  getLedgerBalanceForPeriod as getLedgerBalanceForPeriodInternal,
  getLedgerHashForPeriod,
  verifyLedgerChain,
} from "./ledger/tax-ledger.js";
export type {
  LedgerCategory,
  LedgerDirection,
  LedgerPostArgs,
  LedgerTotals,
  LedgerVerificationResult,
} from "./ledger/tax-ledger.js";

// AU tax config provider (what api-gateway imports)
export { auTaxConfigProvider } from "./au-tax/au-tax-config-provider.js";
export type { AuTaxConfigProvider } from "./au-tax/types.js";

// Keep your existing repo exports (if you use them elsewhere)
export { resolveAuTaxConfig } from "./au-tax/resolve-au-tax-config.js";
export * from "./au-tax/tax-config-repo.from-provider.js";
export { prismaTaxConfigRepository } from "./au-tax/tax-config-repo.prisma.js";

// Types api-gateway imports
export type { GstBatch } from "./models/gst.js";
export type { PosTransaction } from "./models/pos.js";
export type { PayrollBatch } from "./models/payroll.js";

// Outcomes
export { runBasOutcomeV1FromContext } from "./outcomes/bas-outcome.js";
export type { RiskBand, BasOutcomeV1RunResult } from "./outcomes/bas-outcome.js";
