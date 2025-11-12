import type { PrismaClient } from "@prisma/client";
import { applyDesignatedAccountTransfer, generateDesignatedAccountReconciliationArtifact, type ApplyDesignatedTransferResult, type DesignatedReconciliationSummary } from "@apgms/domain-policy";
export type ConnectorContext = {
    prisma: PrismaClient;
    auditLogger?: (entry: {
        orgId: string;
        actorId: string;
        action: string;
        metadata?: Record<string, unknown> | null;
    }) => Promise<void> | void;
};
export type CaptureInput = {
    orgId: string;
    amount: number;
    actorId: string;
};
type ConnectorDependencies = {
    applyTransfer: typeof applyDesignatedAccountTransfer;
    generateArtifact: typeof generateDesignatedAccountReconciliationArtifact;
};
type CaptureResult = {
    transfer: ApplyDesignatedTransferResult;
    artifact: {
        artifactId: string;
        sha256: string;
        summary: DesignatedReconciliationSummary;
    };
};
export declare function capturePayroll(context: ConnectorContext, input: CaptureInput, dependencies?: ConnectorDependencies): Promise<CaptureResult>;
export declare function capturePos(context: ConnectorContext, input: CaptureInput, dependencies?: ConnectorDependencies): Promise<CaptureResult>;
export {};
//# sourceMappingURL=index.d.ts.map