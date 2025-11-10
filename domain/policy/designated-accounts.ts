import { createHash } from "node:crypto";

import {
  Prisma,
  type PrismaClient,
  DesignatedAccountStatus,
  ReconciliationStatus,
} from "@prisma/client";

import { conflict, notFound } from "@apgms/shared";
import {
  evaluateDesignatedAccountPolicy,
  normalizeTransferSource,
  type DesignatedTransferSource,
} from "@apgms/shared/ledger";

type AuditLogger = (entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}) => Promise<void>;

type PolicyContext = {
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

async function ensureViolationAlert(
  prisma: PrismaClient,
  orgId: string,
  message: string,
): Promise<void> {
  const existing = await prisma.alert.findFirst({
    where: {
      orgId,
      type: "DESIGNATED_WITHDRAWAL_ATTEMPT",
      severity: "HIGH",
      resolvedAt: null,
    },
  });

  if (existing) {
    return;
  }

  await prisma.alert.create({
    data: {
      orgId,
      type: "DESIGNATED_WITHDRAWAL_ATTEMPT",
      severity: "HIGH",
      message,
    },
  });
}

async function recordDesignatedState(
  prisma: PrismaClient,
  entry: {
    orgId: string;
    accountId: string;
    actorId: string;
    status: DesignatedAccountStatus;
    reason?: string;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await prisma.designatedAccountState.create({
      data: {
        orgId: entry.orgId,
        accountId: entry.accountId,
        actorId: entry.actorId,
        status: entry.status,
        reason: entry.reason,
        context: entry.context ?? {},
      },
    });
  } catch (error) {
    // Capture-but-don't-fail; the calling flow should not break if the
    // designated account has been removed between validation and persistence.
    if (process.env.NODE_ENV === "development") {
      console.warn("designatedAccountState.persist_failed", error);
    }
  }
}

export async function applyDesignatedAccountTransfer(
  context: PolicyContext,
  input: ApplyDesignatedTransferInput,
): Promise<ApplyDesignatedTransferResult> {
  const evaluation = evaluateDesignatedAccountPolicy({
    amount: input.amount,
    source: input.source,
  });

  if (!evaluation.allowed) {
    const account = await context.prisma.designatedAccount.findUnique({
      where: { id: input.accountId },
    });
    if (account && account.orgId === input.orgId) {
      await recordDesignatedState(context.prisma, {
        orgId: input.orgId,
        accountId: input.accountId,
        actorId: input.actorId,
        status: DesignatedAccountStatus.VIOLATION,
        reason: evaluation.violation.message,
        context: {
          amount: input.amount,
          source: input.source,
          violation: evaluation.violation.code,
        },
      });
    }

    await ensureViolationAlert(
      context.prisma,
      input.orgId,
      evaluation.violation.message,
    );

    if (context.auditLogger) {
      await context.auditLogger({
        orgId: input.orgId,
        actorId: input.actorId,
        action: "designatedAccount.violation",
        metadata: {
          accountId: input.accountId,
          amount: input.amount,
          source: input.source,
          violation: evaluation.violation.code,
        },
      });
    }

    throw conflict(
      evaluation.violation.code,
      evaluation.violation.message,
    );
  }

  const normalizedSource = normalizeTransferSource(input.source);
  if (!normalizedSource) {
    // Defensive, should not happen given evaluation above.
    throw conflict(
      "designated_untrusted_source",
      `Designated account funding source '${input.source}' is not whitelisted`,
    );
  }

  const amountDecimal = new Prisma.Decimal(input.amount);

  const result = await context.prisma.$transaction(async (tx) => {
    const account = await tx.designatedAccount.findUnique({
      where: { id: input.accountId },
    });

    if (!account || account.orgId !== input.orgId) {
      throw notFound(
        "designated_account_not_found",
        "Designated account not found for organisation",
      );
    }

    const updatedBalance = account.balance.add(amountDecimal);

    await tx.designatedAccount.update({
      where: { id: account.id },
      data: {
        balance: updatedBalance,
        updatedAt: new Date(),
      },
    });

    const transfer = await tx.designatedTransfer.create({
      data: {
        orgId: input.orgId,
        accountId: account.id,
        amount: amountDecimal,
        source: normalizedSource,
      },
    });

    await recordDesignatedState(tx as unknown as PrismaClient, {
      orgId: input.orgId,
      accountId: account.id,
      actorId: input.actorId,
      status: DesignatedAccountStatus.ACTIVE,
      reason: "Designated account credited",
      context: {
        transferId: transfer.id,
        amount: input.amount,
        source: normalizedSource,
      },
    });

    return {
      accountId: account.id,
      newBalance: Number(updatedBalance),
      transferId: transfer.id,
      source: normalizedSource,
    };
  });

  if (context.auditLogger) {
    await context.auditLogger({
      orgId: input.orgId,
      actorId: input.actorId,
      action: "designatedAccount.credit",
      metadata: {
        accountId: result.accountId,
        amount: input.amount,
        source: result.source,
        transferId: result.transferId,
      },
    });
  }

  return result;
}

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

export async function generateDesignatedAccountReconciliationArtifact(
  context: PolicyContext,
  orgId: string,
  actorId = "system",
): Promise<{
  summary: DesignatedReconciliationSummary;
  artifactId: string;
  sha256: string;
}> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const accounts = await context.prisma.designatedAccount.findMany({
    where: { orgId },
    include: {
      transfers: {
        where: {
          createdAt: {
            gte: cutoff,
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const movements = accounts.map((account) => {
    const inflow = account.transfers.reduce((acc, transfer) => {
      return acc + Number(transfer.amount);
    }, 0);

    return {
      accountId: account.id,
      type: account.type,
      balance: Number(account.balance),
      inflow24h: Number(inflow.toFixed(2)),
      transferCount24h: account.transfers.length,
    };
  });

  const totals = movements.reduce(
    (acc, entry) => {
      if (entry.type.toUpperCase() === "PAYGW") {
        acc.paygw += entry.balance;
      } else if (entry.type.toUpperCase() === "GST") {
        acc.gst += entry.balance;
      }
      return acc;
    },
    { paygw: 0, gst: 0 },
  );

  const summary: DesignatedReconciliationSummary = {
    generatedAt: now.toISOString(),
    totals,
    movementsLast24h: movements,
  };

  const sha256 = createHash("sha256")
    .update(JSON.stringify(summary))
    .digest("hex");

  const artifact = await context.prisma.$transaction(async (tx) => {
    const created = await tx.evidenceArtifact.create({
      data: {
        orgId,
        kind: "designated-reconciliation",
        wormUri: "internal:designated/pending",
        sha256,
        payload: summary,
      },
    });

    return tx.evidenceArtifact.update({
      where: { id: created.id },
      data: {
        wormUri: `internal:designated/${created.id}`,
      },
    });
  });

  const accountSnapshots = accounts.map((account) => ({
    orgId,
    accountId: account.id,
    artifactId: artifact.id,
    status: ReconciliationStatus.IN_BALANCE,
    internalBalance: account.balance,
    variance: new Prisma.Decimal(0),
    details: {
      inflow24h: account.transfers.reduce((acc, transfer) => acc + Number(transfer.amount), 0),
      transferCount24h: account.transfers.length,
    },
  }));

  const aggregateBalance = accounts.reduce(
    (acc, account) => acc.add(account.balance),
    new Prisma.Decimal(0),
  );

  await context.prisma.designatedAccountReconciliationSnapshot.createMany({
    data: [
      ...accountSnapshots,
      {
        orgId,
        artifactId: artifact.id,
        status: ReconciliationStatus.IN_BALANCE,
        internalBalance: aggregateBalance,
        variance: new Prisma.Decimal(0),
        details: summary,
      },
    ],
  });

  if (accounts.length > 0) {
    await context.prisma.designatedAccountState.createMany({
      data: accounts.map((account) => ({
        orgId,
        accountId: account.id,
        actorId,
        status: DesignatedAccountStatus.RECONCILED,
        reason: "Automated reconciliation completed",
        context: {
          artifactId: artifact.id,
          balance: account.balance,
          generatedAt: summary.generatedAt,
        },
      })),
    });
  }

  if (context.auditLogger) {
    await context.auditLogger({
      orgId,
      actorId,
      action: "designatedAccount.reconciliation",
      metadata: {
        artifactId: artifact.id,
        sha256,
        totals,
      },
    });
  }

  return {
    summary,
    artifactId: artifact.id,
    sha256,
  };
}
