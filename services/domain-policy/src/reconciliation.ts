// services/domain-policy/src/reconciliation.ts

import type { PrismaClient, AuditLogger } from "./designated-accounts";

/**
 * Extremely loose shape – just enough to satisfy connectors
 * and allow api-gateway to build and run.
 */
export interface DesignatedReconciliationSummary {
  orgId: string;
  accountId: string;
  asOfDate: string;
  status: "NOT_IMPLEMENTED" | string;
  // Allow anything else for now
  [key: string]: any;
}

export interface GenerateDesignatedAccountReconciliationArgs {
  prisma: PrismaClient;
  auditLogger?: AuditLogger;
  orgId: string;
  accountId: string;
  asOfDate?: Date | string;
}

/**
 * Stub implementation – returns a synthetic summary and does NOT
 * hit the database. This lets the rest of the stack compile while
 * you flesh out real policy later.
 */
export async function generateDesignatedAccountReconciliationArtifact(
  args: GenerateDesignatedAccountReconciliationArgs,
): Promise<DesignatedReconciliationSummary> {
  const { orgId, accountId, asOfDate } = args;

  return {
    orgId,
    accountId,
    asOfDate:
      typeof asOfDate === "string"
        ? asOfDate
        : (asOfDate ?? new Date()).toISOString(),
    status: "NOT_IMPLEMENTED",
  };
}
