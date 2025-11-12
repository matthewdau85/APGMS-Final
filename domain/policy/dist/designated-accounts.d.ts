import { type PrismaClient } from "@prisma/client";
import { type DesignatedTransferSource } from "@apgms/shared/ledger";
export type AuditLogger = (entry: {
    orgId: string;
    actorId: string;
    action: string;
    metadata: Record<string, unknown>;
}) => Promise<void>;
export type PolicyContext = {
    prisma: PrismaClient;
    auditLogger?: AuditLogger;
};
export type ApplyDesignatedTransferInput = {
    orgId: string;
    accountId: string;
    amount: number;
    source: string;
    actorId: string;
};
export type ApplyDesignatedTransferResult = {
    accountId: string;
    newBalance: number;
    transferId: string;
    source: DesignatedTransferSource;
};
export declare function applyDesignatedAccountTransfer(context: PolicyContext, input: ApplyDesignatedTransferInput): Promise<ApplyDesignatedTransferResult>;
export type DesignatedReconciliationSummary = {
    generatedAt: string;
    totals: {
        paygw: number;
        gst: number;
    };
    movementsLast24h: Array<{
        accountId: string;
        type: string;
        balance: number;
        inflow24h: number;
        transferCount24h: number;
    }>;
};
export declare function generateDesignatedAccountReconciliationArtifact(context: PolicyContext, orgId: string, actorId?: string): Promise<{
    summary: DesignatedReconciliationSummary;
    artifactId: string;
    sha256: string;
}>;
