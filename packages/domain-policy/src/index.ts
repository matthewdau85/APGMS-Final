// packages/domain-policy/src/index.ts

// ---------------------------------------------------------------------------
// Designated one-way account domain – top-level helpers
// ---------------------------------------------------------------------------

export {
  applyDesignatedAccountTransfer,
  generateDesignatedAccountReconciliationArtifact,
} from "./designated-accounts.js";

export type {
  PrismaClient,
  DesignatedTransferSource,
  AuditLogger,
  ApplyDesignatedTransferContext,
  ApplyDesignatedTransferInput,
  ApplyDesignatedTransferResult,
  DesignatedReconciliationSummary,
  DesignatedAccountReconciliationArtifact,
} from "./designated-accounts";

// If you still want the sub-modules exposed, keep them but split
// runtime vs type-only exports cleanly:

// Designated one-way account domain
export * from "./designated-accounts/guards.js";
export type * from "./designated-accounts/types.js";

// AU tax configuration + engines
export type * from "./au-tax/types.js";
export * from "./au-tax/paygw-engine.js";
export * from "./au-tax/prisma-repository.js";
