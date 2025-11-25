// packages/domain-policy/src/index.ts
// ---------------------------------------------------------------------------
// Designated one-way account domain – top-level helpers
// ---------------------------------------------------------------------------
export * from "./au-tax/bas-types";
export * from "./au-tax/gst-engine";
export * from "./au-tax/paygw-settlement";
export * from "./au-tax/gst-settlement";
export * from "./au-tax/bas-reconciliation";
export * from "./au-tax/bas-lodgment";
export { applyDesignatedAccountTransfer, generateDesignatedAccountReconciliationArtifact, } from "./designated-accounts.js";
// If you still want the sub-modules exposed, keep them but split
// runtime vs type-only exports cleanly:
// Designated one-way account domain
export * from "./designated-accounts/guards.js";
export * from "./au-tax/paygw-engine.js";
export * from "./au-tax/prisma-repository.js";
