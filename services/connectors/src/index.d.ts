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

// --- Reconciliation types & stub implementation ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DesignatedReconciliationSummary = {
  orgId: string;
  accountId: string;
  asOfDate: string;
  status: "BALANCED" | "MISMATCH" | "NOT_IMPLEMENTED";
  openingBalance?: number;
  closingBalance?: number;
  totalCredits?: number;
  totalDebits?: number;
  // Allow extra fields so callers can extend this without breaking
  [key: string]: any;
};

export type DesignatedAccountReconciliationArtifact = {
  artifactId: string;
  sha256: string;
  summary: DesignatedReconciliationSummary;
};

// Very loose ctx on purpose for now; connectors only cares that this
// function exists and returns { artifactId, sha256, summary }.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateDesignatedAccountReconciliationArtifact(
  _ctx: any,
): Promise<DesignatedAccountReconciliationArtifact> {
  const artifactId = `recon-${Date.now().toString(36)}`;

  const summary: DesignatedReconciliationSummary = {
    orgId: "",
    accountId: "",
    asOfDate: new Date().toISOString(),
    status: "NOT_IMPLEMENTED",
  };

  // Stub hash – you can replace with real sha256 later.
  const sha256 = `stub-${artifactId}`;

  return { artifactId, sha256, summary };
}