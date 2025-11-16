import { createHash } from "node:crypto";

import { Decimal } from "@prisma/client/runtime/library";
import type { PrismaClient } from "@prisma/client";

import { conflict, notFound } from "@apgms/shared";
import {
  evaluateDesignatedAccountPolicy,
  normalizeTransferSource,
  type DesignatedTransferSource,
} from "@apgms/shared/ledger";

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

type AccountWithTransfers = {
  id: string;
  type: string;
  balance: Decimal;
  transfers: { amount: Decimal }[];
};

const decimalToCents = (value: Decimal | number): number => {
  const numeric = value instanceof Decimal ? Number(value) : value;
  return Math.round(numeric * 100);
};

const centsToDollars = (cents: number): number => cents / 100;

const runTransaction = async <T>(
  prisma: PrismaClient,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> =>
  prisma.$transaction(
    fn as Parameters<PrismaClient["$transaction"]>[0],
  ) as Promise<T>;

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

  const amountDecimal = new Decimal(input.amount);

  const result = await runTransaction(context.prisma, async (tx) => {
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

    return {
      accountId: account.id,
      newBalance: Number(updatedBalance),
      transferId: transfer.id,
      source: normalizedSource,
    } satisfies ApplyDesignatedTransferResult;
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

type DesignatedMovement = {
  accountId: string;
  type: string;
  balance: number;
  inflow24h: number;
  transferCount24h: number;
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

  const accounts = (await context.prisma.designatedAccount.findMany({
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
  })) as AccountWithTransfers[];

  const movements: DesignatedMovement[] = accounts.map(
    (account: AccountWithTransfers) => {
      const inflowCents = account.transfers.reduce(
        (acc: number, transfer: { amount: Decimal }) =>
          acc + decimalToCents(transfer.amount),
        0,
      );

      return {
        accountId: account.id,
        type: account.type,
        balance: centsToDollars(decimalToCents(account.balance)),
        inflow24h: centsToDollars(inflowCents),
        transferCount24h: account.transfers.length,
      };
    },
  );

  const totals = movements.reduce(
    (
      acc: { paygw: number; gst: number },
      entry: DesignatedMovement,
    ) => {
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

  const artifact = await runTransaction(context.prisma, async (tx) => {
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
