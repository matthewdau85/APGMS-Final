// packages/domain-policy/src/index.ts

// ---------------------------------------------------------------------------
// Core tax types & BAS period
// ---------------------------------------------------------------------------
export * from "./tax-types.js";
export * from "./bas-period.js";
export * from "./obligations/computeOrgObligationsForPeriod";
export * from "./obligations/calculator";
export * from "./obligations/types";

// ---------------------------------------------------------------------------
// AU tax configuration + engines + BAS helpers
// ---------------------------------------------------------------------------
export * from "./au-tax/types.js";
export * from "./au-tax/bas-types.js";
export * from "./au-tax/bas-lodgment.js";
export * from "./au-tax/bas-reconciliation.js";
export * from "./au-tax/paygw-engine.js";
export * from "./au-tax/paygw-settlement.js";
export * from "./au-tax/gst-engine.js";
export * from "./au-tax/gst-settlement.js";
export { computeOrgObligationsForPeriod } from "./obligations/computeOrgObligationsForPeriod.js";
 // export * from "./au-tax/prisma-repository.js";

// ---------------------------------------------------------------------------
// Designated account domain (transfers + mappings + guards)
// ---------------------------------------------------------------------------

// Note: src/designated-accounts.ts (already in your repo) contains the
// applyDesignatedAccountTransfer + reconciliation plumbing. We just
// re-export it plus the supporting types/guards.
export * from "./designated-accounts.js";
export * from "./designated-accounts/types.js";
export * from "./designated-accounts/mappings.js";
export * from "./designated-accounts/guards.js";
export * from "./models/gst.js";
export * from "./models/payroll.js";
export * from "./models/pos.js";

