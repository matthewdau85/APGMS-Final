export { computeOrgObligationsForPeriod } from "./obligations/computeOrgObligationsForPeriod.js";
export { getLedgerBalanceForPeriod } from "./ledger/tax-ledger-public.js";

export * from "./au-tax/tax-config-repo.from-provider.js";
export { prismaTaxConfigRepository } from "./au-tax/tax-config-repo.prisma.js";

/**
 * Gateway-facing DTO types (permissive while routes evolve).
 */
export type PosTransaction = Record<string, any>;

export type GstBatch = {
  orgId: string;
  period?: string;
  transactions?: PosTransaction[];
  rows?: unknown[];
  [k: string]: any;
};

export type PayrollBatch = {
  orgId: string;
  period?: string;
  basPeriodId?: string;
  lines?: unknown[];
  rows?: unknown[];
  [k: string]: any;
};
