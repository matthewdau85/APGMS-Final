import type { PrismaClient } from "@prisma/client";

import {
  applyDesignatedAccountTransfer,
  generateDesignatedAccountReconciliationArtifact,
  type ApplyDesignatedTransferInput,
  type ApplyDesignatedTransferResult,
  type AuditLogger,
  type DesignatedReconciliationSummary,
} from "@apgms/domain-policy";

export type ConnectorContext = {
  prisma: PrismaClient;
  auditLogger?: AuditLogger;
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

const defaultDependencies: ConnectorDependencies = {
  applyTransfer: applyDesignatedAccountTransfer,
  generateArtifact: generateDesignatedAccountReconciliationArtifact,
};

type CaptureResult = {
  transfer: ApplyDesignatedTransferResult;
  artifact: {
    artifactId: string;
    sha256: string;
    summary: DesignatedReconciliationSummary;
  };
};

const ACCOUNT_TYPE_BY_CAPTURE = {
  payroll: "PAYGW",
  pos: "GST",
} as const;

const SOURCE_BY_CAPTURE = {
  payroll: "PAYROLL_CAPTURE",
  pos: "GST_CAPTURE",
} as const;

function captureError(type: keyof typeof ACCOUNT_TYPE_BY_CAPTURE, orgId: string) {
  return new Error(`designated_account_missing:${type}:${orgId}`);
}

async function resolveAccount(
  context: ConnectorContext,
  input: CaptureInput,
  accountType: string,
) {
  const account = await context.prisma.designatedAccount.findFirst({
    where: { orgId: input.orgId, type: accountType },
  });
  if (!account) {
    throw captureError(accountType as keyof typeof ACCOUNT_TYPE_BY_CAPTURE, input.orgId);
  }
  return account;
}

async function captureFunds(
  context: ConnectorContext,
  input: CaptureInput,
  captureType: keyof typeof ACCOUNT_TYPE_BY_CAPTURE,
  dependencies: ConnectorDependencies,
): Promise<CaptureResult> {
  const accountType = ACCOUNT_TYPE_BY_CAPTURE[captureType];
  const source = SOURCE_BY_CAPTURE[captureType];
  const account = await resolveAccount(context, input, accountType);

  const transfer = await dependencies.applyTransfer(
    {
      prisma: context.prisma,
      auditLogger: context.auditLogger,
    },
    {
      orgId: input.orgId,
      accountId: account.id,
      amount: input.amount,
      source,
      actorId: input.actorId,
    } satisfies ApplyDesignatedTransferInput,
  );

  const artifact = await dependencies.generateArtifact(
    context,
    input.orgId,
    input.actorId,
  );

  return {
    transfer,
    artifact: {
      artifactId: artifact.artifactId,
      sha256: artifact.sha256,
      summary: artifact.summary,
    },
  };
}

export async function capturePayroll(
  context: ConnectorContext,
  input: CaptureInput,
  dependencies: ConnectorDependencies = defaultDependencies,
) {
  return captureFunds(context, input, "payroll", dependencies);
}

export async function capturePos(
  context: ConnectorContext,
  input: CaptureInput,
  dependencies: ConnectorDependencies = defaultDependencies,
) {
  return captureFunds(context, input, "pos", dependencies);
}
