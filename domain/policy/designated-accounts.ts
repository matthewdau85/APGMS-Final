import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

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

    if (account.depositOnly === false) {
      throw conflict(
        "designated_account_not_deposit_only",
        "Designated accounts must be flagged as deposit-only",
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

    const previousAudit = await tx.designatedAccountAuditLog.findFirst({
      where: { orgId: input.orgId, accountId: account.id },
      orderBy: { createdAt: "desc" },
    });

    const auditPayload = {
      transferId: transfer.id,
      amount: amountDecimal.toString(),
      source: normalizedSource,
      actorId: input.actorId,
      occurredAt: new Date().toISOString(),
    };

    const hash = createHash("sha256")
      .update(previousAudit?.hash ?? "")
      .update(JSON.stringify(auditPayload))
      .digest("hex");

    await tx.designatedAccountAuditLog.create({
      data: {
        orgId: input.orgId,
        accountId: account.id,
        transferId: transfer.id,
        actorId: input.actorId,
        action: "designatedAccount.credit",
        amount: amountDecimal,
        metadata: { source: normalizedSource },
        hash,
        prevHash: previousAudit?.hash,
      },
    });

    await tx.designatedAccountReconciliation.create({
      data: {
        orgId: input.orgId,
        accountId: account.id,
        transferId: transfer.id,
        expectedCredit: amountDecimal,
        recordedBalance: updatedBalance,
        observedBalance: updatedBalance,
        details: {
          source: normalizedSource,
          actorId: input.actorId,
        },
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

  await context.prisma.$transaction(async (tx) => {
    for (const account of accounts) {
      const pending = await tx.designatedAccountReconciliation.findMany({
        where: { accountId: account.id, status: "PENDING" },
      });

      if (!pending.length) continue;

      const observed = new Prisma.Decimal(account.balance);

      for (const entry of pending) {
        const discrepancy = observed.minus(entry.recordedBalance);
        const severityThreshold = new Prisma.Decimal(0.01);
        const status = discrepancy.abs().greaterThan(severityThreshold)
          ? "ESCALATED"
          : "RECONCILED";

        await tx.designatedAccountReconciliation.update({
          where: { id: entry.id },
          data: {
            observedBalance: observed,
            discrepancy,
            status,
            reconciledAt: now,
            details: {
              ...(entry.details ?? {}),
              movements: account.transfers.length,
              reconciledAt: now.toISOString(),
            },
          },
        });
      }
    }
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
