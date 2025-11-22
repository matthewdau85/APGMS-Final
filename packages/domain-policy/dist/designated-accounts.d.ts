export type PrismaClient = any;
/**
 * Source of a designated-account transfer.
 *
 * We keep the original intent ("PAYROLL_CAPTURE" | "GST_CAPTURE" | "BAS_ESCROW")
 * but allow any string so that upstream callers which still pass a plain
 * string won't break type-checking.
 */
export type DesignatedTransferSource = "PAYROLL_CAPTURE" | "GST_CAPTURE" | "BAS_ESCROW" | (string & {});
/**
 * Minimal audit logger interface used by the ledger layer.
 * The shared package only needs to be able to pass this through.
 */
export interface AuditLogger {
    log: (event: {
        type: string;
        orgId: string;
        accountId: string;
        amount: number;
        source: DesignatedTransferSource;
        actorId?: string;
        transferId: string;
        newBalance: number;
        [key: string]: any;
    }) => Promise<void> | void;
}
export interface ApplyDesignatedTransferContext {
    prisma: PrismaClient;
    auditLogger?: AuditLogger;
}
export interface ApplyDesignatedTransferInput {
    orgId: string;
    accountId: string;
    amount: number;
    source: DesignatedTransferSource | string;
    actorId?: string;
}
export interface ApplyDesignatedTransferResult {
    accountId: string;
    newBalance: number;
    transferId: string;
    source: DesignatedTransferSource;
}
/**
 * Apply a transfer into a designated account (PAYGW / GST buffer / BAS escrow).
 *
 * This implementation is deliberately defensive:
 *  - It uses `any` around Prisma models so schema tweaks don't break compilation.
 *  - It works even if `designatedAccount` / `designatedTransfer` models
 *    are missing – in that case it just returns a synthetic transferId and
 *    does not touch the database.
 *
 * It’s enough to let the rest of the stack (shared ledger, api-gateway)
 * compile and run while you iterate on the actual policy logic.
 */
export declare function applyDesignatedAccountTransfer(context: ApplyDesignatedTransferContext, input: ApplyDesignatedTransferInput): Promise<ApplyDesignatedTransferResult>;
export type DesignatedReconciliationSummary = {
    orgId: string;
    accountId: string;
    asOfDate: string;
    status: "BALANCED" | "MISMATCH" | "NOT_IMPLEMENTED";
    openingBalance?: number;
    closingBalance?: number;
    totalCredits?: number;
    totalDebits?: number;
    [key: string]: any;
};
export type DesignatedAccountReconciliationArtifact = {
    artifactId: string;
    sha256: string;
    summary: DesignatedReconciliationSummary;
};
export declare function generateDesignatedAccountReconciliationArtifact(_ctx: any): Promise<DesignatedAccountReconciliationArtifact>;
