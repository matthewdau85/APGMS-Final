import { createHash } from "node:crypto";

import {
  Prisma,
  type PrismaClient,
  DesignatedAccountState,
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

type PrismaTx = Prisma.TransactionClient;

async function getLatestAccountState(
  tx: PrismaTx,
  accountId: string,
): Promise<DesignatedAccountState | null> {
  const state = await tx.designatedAccountStateTransition.findFirst({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });

  return state?.toState ?? null;
}

async function ensureAccountStateInitialized(
  tx: PrismaTx,
  orgId: string,
  accountId: string,
  actorId: string,
): Promise<DesignatedAccountState> {
  const existing = await getLatestAccountState(tx, accountId);
  if (existing) {
    return existing;
  }

  await tx.designatedAccountStateTransition.create({
    data: {
      orgId,
      accountId,
      fromState: null,
      toState: DesignatedAccountState.ACTIVE,
      actorId,
      reason: "initialised",
      metadata: {
        note: "Automatically initialised on first touch",
      },
    },
  });

  return DesignatedAccountState.ACTIVE;
}

async function transitionAccountState(
  tx: PrismaTx,
  orgId: string,
  accountId: string,
  fromState: DesignatedAccountState | null,
  toState: DesignatedAccountState,
  actorId: string,
  reason: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await tx.designatedAccountStateTransition.create({
    data: {
      orgId,
      accountId,
      fromState,
      toState,
      actorId,
      reason,
      metadata,
    },
  });
}

async function flagDesignatedViolation(
  prisma: PrismaClient,
  input: {
    orgId: string;
    accountId: string;
    actorId: string;
    code: string;
    severity: string;
    message: string;
    source: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existingFlag = await tx.designatedViolationFlag.findFirst({
      where: {
        orgId: input.orgId,
        accountId: input.accountId,
        code: input.code,
        status: "OPEN",
      },
    });

    if (!existingFlag) {
      await tx.designatedViolationFlag.create({
        data: {
          orgId: input.orgId,
          accountId: input.accountId,
          code: input.code,
          severity: input.severity,
          metadata: {
            message: input.message,
            source: input.source,
          },
        },
      });
    }

    const currentState = await getLatestAccountState(tx, input.accountId);
    if (currentState !== DesignatedAccountState.INVESTIGATING) {
      await transitionAccountState(
        tx,
        input.orgId,
        input.accountId,
        currentState,
        DesignatedAccountState.INVESTIGATING,
        input.actorId,
        "violation_detected",
        {
          code: input.code,
          severity: input.severity,
        },
      );
    }
  });
}

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

export async function applyDesignatedAccountTransfer(
  context: PolicyContext,
  input: ApplyDesignatedTransferInput,
): Promise<ApplyDesignatedTransferResult> {
  const evaluation = evaluateDesignatedAccountPolicy({
    amount: input.amount,
    source: input.source,
  });

  if (!evaluation.allowed) {
    await ensureViolationAlert(
      context.prisma,
      input.orgId,
      evaluation.violation.message,
    );

    await flagDesignatedViolation(context.prisma, {
      orgId: input.orgId,
      accountId: input.accountId,
      actorId: input.actorId,
      code: evaluation.violation.code,
      severity: evaluation.violation.severity,
      message: evaluation.violation.message,
      source: input.source,
    });

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

    const currentState = await ensureAccountStateInitialized(
      tx,
      account.orgId,
      account.id,
      input.actorId,
    );

    if (
      currentState === DesignatedAccountState.LOCKED ||
      currentState === DesignatedAccountState.CLOSED
    ) {
      throw conflict(
        "designated_account_locked",
        "Designated account is locked pending manual review",
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
  snapshotId: string;
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

  const { artifact, snapshot } = await context.prisma.$transaction(
    async (tx) => {
      const created = await tx.evidenceArtifact.create({
        data: {
          orgId,
          kind: "designated-reconciliation",
          wormUri: "internal:designated/pending",
          sha256,
          payload: summary,
        },
      });

      const snapshotRecord = await tx.designatedReconciliationSnapshot.create({
        data: {
          orgId,
          paygwBalance: new Prisma.Decimal(totals.paygw),
          gstBalance: new Prisma.Decimal(totals.gst),
          payload: summary,
          sha256,
          actorId,
          evidenceArtifactId: created.id,
        },
      });

      const finalArtifact = await tx.evidenceArtifact.update({
        where: { id: created.id },
        data: {
          wormUri: `internal:designated/${created.id}`,
        },
      });

      return { artifact: finalArtifact, snapshot: snapshotRecord };
    },
  );

  if (context.auditLogger) {
    await context.auditLogger({
      orgId,
      actorId,
      action: "designatedAccount.reconciliation",
      metadata: {
        artifactId: artifact.id,
        sha256,
        totals,
        snapshotId: snapshot.id,
      },
    });
  }

  return {
    summary,
    artifactId: artifact.id,
    sha256,
    snapshotId: snapshot.id,
  };
}
