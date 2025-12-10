export type ConnectorContext = {
    prisma: any;
    auditLogger?: (entry: {
        orgId: string;
        actorId: string;
        action: string;
        details?: unknown;
    }) => Promise<void> | void;
};
export interface CaptureInput {
    orgId: string;
    streamId: string;
    externalRef: string;
    amountCents: number;
    currency: string;
    occurredAt: Date;
}
/**
 * Minimal shape for the result of a designated-account transfer.
 * This mirrors what your domain code produces but stays decoupled here.
 */
export interface ApplyDesignatedTransferResult {
    journalId: string;
}
/**
 * Shape of the reconciliation summary produced after applying a transfer.
 * This is intentionally loose to avoid tight domain coupling.
 */
export interface DesignatedReconciliationSummary {
    orgId: string;
    captureId: string;
    transferJournalId: string;
}
export interface CaptureResult {
    ok: boolean;
    reconciliation?: DesignatedReconciliationSummary;
    transferResult?: ApplyDesignatedTransferResult;
}
/**
 * Dependencies that perform the actual domain work.
 *
 * In production you will inject the real implementations
 * (e.g. from @apgms/domain-policy or a service layer).
 */
export interface ConnectorDependencies {
    applyTransfer: (args: {
        orgId: string;
        captureId: string;
        amountCents: number;
        currency: string;
    }) => Promise<ApplyDesignatedTransferResult>;
    generateReconciliation: (args: {
        orgId: string;
        captureId: string;
        transferJournalId: string;
    }) => Promise<DesignatedReconciliationSummary>;
}
/**
 * Core orchestration function:
 * 1) Persist the raw capture event.
 * 2) Apply designated-account transfer.
 * 3) Generate reconciliation artifact.
 * 4) Emit audit log entry (if an audit logger is provided).
 */
export declare function runCapture(context: ConnectorContext, input: CaptureInput, reason: string, deps?: ConnectorDependencies): Promise<CaptureResult>;
/**
 * Convenience wrapper for common POS capture flows.
 * You can add more specialised helpers later (bankCapture, eftposCapture, etc.).
 */
export declare function capturePos(context: ConnectorContext, input: CaptureInput, dependencies?: ConnectorDependencies): Promise<CaptureResult>;
//# sourceMappingURL=index.d.ts.map