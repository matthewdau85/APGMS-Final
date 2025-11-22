// services/connectors/src/index.ts

import type { PrismaClient } from "@prisma/client";
import {
  applyDesignatedAccountTransfer,
  generateDesignatedAccountReconciliationArtifact,
  type ApplyDesignatedTransferResult,
  type DesignatedReconciliationSummary,
} from "@apgms/domain-policy";

export type ConnectorContext = {
  prisma: PrismaClient;
  auditLogger?: (entry: {
    orgId: string;
    actorId: string;
    action: string;
    metadata?: Record<string, unknown> | null;
  }) => Promise<void> | void;
};

// Alias used by api-gateway/app.ts
export type ConnectorRoutesDeps = ConnectorContext;

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

const DEFAULT_DEPS: ConnectorDependencies = {
  applyTransfer: applyDesignatedAccountTransfer,
  generateArtifact: generateDesignatedAccountReconciliationArtifact,
};

async function runCapture(
  context: ConnectorContext,
  input: CaptureInput,
  source: string,
  deps: ConnectorDependencies,
): Promise<CaptureResult> {
  const { prisma, auditLogger } = context;
  const { orgId, amount, actorId } = input;

  // Wire the simple auditLogger into the domain-policy AuditLogger shape
  const transfer = await deps.applyTransfer(
    {
      prisma: prisma as unknown as any,
      auditLogger: auditLogger
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            log: async (event: Record<string, any>) => {
              await auditLogger({
                orgId: String(event.orgId ?? orgId),
                actorId: String(event.actorId ?? actorId ?? "system"),
                action: String(event.type ?? "DESIGNATED_ACCOUNT_TRANSFER"),
                metadata: event,
              });
            },
          }
        : undefined,
    },
    {
      orgId,
      accountId: "payroll-buffer", // domain-policy shim is tolerant of this
      amount,
      source,
      actorId,
    },
  );

  const artifact = await deps.generateArtifact({
    orgId,
    accountId: transfer.accountId,
    asOfDate: new Date().toISOString(),
  });

  return {
    transfer,
    artifact,
  };
}

export async function capturePayroll(
  context: ConnectorContext,
  input: CaptureInput,
  dependencies?: ConnectorDependencies,
): Promise<CaptureResult> {
  const deps = dependencies ?? DEFAULT_DEPS;
  return runCapture(context, input, "PAYROLL_CAPTURE", deps);
}

export async function capturePos(
  context: ConnectorContext,
  input: CaptureInput,
  dependencies?: ConnectorDependencies,
): Promise<CaptureResult> {
  const deps = dependencies ?? DEFAULT_DEPS;
  return runCapture(context, input, "GST_CAPTURE", deps);
}
