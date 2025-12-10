import type { PrismaClient } from "@prisma/client";
export type ContributionSource = "payroll_system" | "pos_system";
export type ContributionResult = {
    payrollApplied: number;
    posApplied: number;
};
/**
 * Minimal audit logger shape – matches the pattern used elsewhere
 * but lives locally so this module does not depend on domain-policy.
 */
export type AuditLogger = (entry: {
    orgId: string;
    actorId: string;
    action: string;
    details?: unknown;
}) => Promise<void> | void;
/**
 * Dependency signature for the designated-account transfer function.
 * In production you will pass `applyDesignatedAccountTransfer` from
 * @apgms/domain-policy, but this file stays decoupled.
 */
export type ApplyDesignatedTransfer = (deps: {
    prisma: PrismaClient;
    auditLogger?: AuditLogger;
}, input: {
    orgId: string;
    accountId: string;
    amount: number;
    source: string;
    actorId: string;
}) => Promise<{
    transferId: string;
}>;
export declare function recordPayrollContribution(params: {
    prisma: PrismaClient;
    orgId: string;
    amount: number;
    actorId?: string;
    payload?: unknown;
    idempotencyKey?: string;
}): Promise<void>;
export declare function recordPosTransaction(params: {
    prisma: PrismaClient;
    orgId: string;
    amount: number;
    actorId?: string;
    payload?: unknown;
    idempotencyKey?: string;
}): Promise<void>;
export declare function applyPendingContributions(params: {
    prisma: PrismaClient;
    orgId: string;
    applyTransfer: ApplyDesignatedTransfer;
    actorId?: string;
    auditLogger?: AuditLogger;
}): Promise<ContributionResult>;
export declare function summarizeContributions(prisma: PrismaClient, orgId: string): Promise<{
    paygwSecured: number;
    gstSecured: number;
}>;
//# sourceMappingURL=ingest.d.ts.map