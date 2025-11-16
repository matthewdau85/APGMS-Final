import { Decimal } from "@prisma/client/runtime/library";
import type { PrismaClient } from "@prisma/client";
import { withIdempotency } from "../idempotency.js";
import { getDesignatedAccountByType } from "./designated-account.js";
import { applyDesignatedAccountTransfer, type AuditLogger } from "@apgms/domain-policy";

export type ContributionSource = "payroll_system" | "pos_system";

const PAYROLL_SOURCE: ContributionSource = "payroll_system";
const POS_SOURCE: ContributionSource = "pos_system";

export type ContributionResult = {
  payrollApplied: number;
  posApplied: number;
};

export async function recordPayrollContribution(params: {
  prisma: PrismaClient;
  orgId: string;
  amount: number;
  actorId?: string;
  payload?: unknown;
  idempotencyKey?: string;
}): Promise<void> {
  await withIdempotency(
    {
      headers: params.idempotencyKey
        ? { "Idempotency-Key": params.idempotencyKey }
        : undefined,
    },
    null,
    {
      prisma: params.prisma,
      orgId: params.orgId,
      requestPayload: {
        amount: params.amount,
        type: PAYROLL_SOURCE,
        payload: params.payload,
      },
      resource: "payrollContribution",
    },
    async ({ idempotencyKey }) => {
      await params.prisma.payrollContribution.create({
        data: {
          orgId: params.orgId,
          amount: new Decimal(params.amount),
          source: PAYROLL_SOURCE,
          payload: params.payload ?? null,
          actorId: params.actorId,
          idempotencyKey,
        },
      });
    },
  );
}

export async function recordPosTransaction(params: {
  prisma: PrismaClient;
  orgId: string;
  amount: number;
  actorId?: string;
  payload?: unknown;
  idempotencyKey?: string;
}): Promise<void> {
  await withIdempotency(
    {
      headers: params.idempotencyKey
        ? { "Idempotency-Key": params.idempotencyKey }
        : undefined,
    },
    null,
    {
      prisma: params.prisma,
      orgId: params.orgId,
      requestPayload: {
        amount: params.amount,
        type: POS_SOURCE,
        payload: params.payload,
      },
      resource: "posTransaction",
    },
    async ({ idempotencyKey }) => {
      await params.prisma.posTransaction.create({
        data: {
          orgId: params.orgId,
          amount: new Decimal(params.amount),
          source: POS_SOURCE,
          payload: params.payload ?? null,
          actorId: params.actorId,
          idempotencyKey,
        },
      });
    },
  );
}

export async function applyPendingContributions(params: {
  prisma: PrismaClient;
  orgId: string;
  actorId?: string;
  auditLogger?: AuditLogger;
}): Promise<ContributionResult> {
  const pendingPayroll = await params.prisma.payrollContribution.findMany({
    where: { orgId: params.orgId, appliedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const pendingPos = await params.prisma.posTransaction.findMany({
    where: { orgId: params.orgId, appliedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const context = { prisma: params.prisma, auditLogger: params.auditLogger };

  for (const contribution of pendingPayroll) {
    await applyContribution(contribution, {
      orgId: params.orgId,
      accountType: "PAYGW_BUFFER",
      actorId: params.actorId ?? contribution.actorId ?? "system",
      context,
      table: "payroll",
    });
  }

  for (const contribution of pendingPos) {
    await applyContribution(contribution, {
      orgId: params.orgId,
      accountType: "GST_BUFFER",
      actorId: params.actorId ?? contribution.actorId ?? "system",
      context,
      table: "pos",
    });
  }

  return {
    payrollApplied: pendingPayroll.length,
    posApplied: pendingPos.length,
  };
}

type ApplyContributionContext = {
  orgId: string;
  accountType: "PAYGW_BUFFER" | "GST_BUFFER";
  actorId: string;
  context: {
    prisma: PrismaClient;
    auditLogger?: AuditLogger;
  };
  table: "payroll" | "pos";
};

async function applyContribution(
  contribution: {
    id: string;
    amount: Decimal;
    source: string;
    idempotencyKey?: string | null;
  },
  params: ApplyContributionContext,
): Promise<void> {
  const account = await getDesignatedAccountByType(
    params.context.prisma,
    params.orgId,
    params.accountType,
  );
  const transfer = await applyDesignatedAccountTransfer(
    {
      prisma: params.context.prisma,
      auditLogger: params.context.auditLogger,
    },
    {
      orgId: params.orgId,
      accountId: account.id,
      amount: Number(contribution.amount),
      source: contribution.source,
      actorId: params.actorId,
    },
  );

  const update =
    params.table === "payroll"
      ? params.context.prisma.payrollContribution.update({
          where: { id: contribution.id },
          data: {
            appliedAt: new Date(),
            transferId: transfer.transferId,
          },
        })
      : params.context.prisma.posTransaction.update({
          where: { id: contribution.id },
          data: {
            appliedAt: new Date(),
            transferId: transfer.transferId,
          },
        });
  await update;
}

export async function summarizeContributions(prisma: PrismaClient, orgId: string) {
  const payrollSummary = await prisma.payrollContribution.aggregate({
    _sum: { amount: true },
    where: { orgId, appliedAt: { not: null } },
  });
  const posSummary = await prisma.posTransaction.aggregate({
    _sum: { amount: true },
    where: { orgId, appliedAt: { not: null } },
  });
  return {
    paygwSecured: Number(payrollSummary._sum.amount ?? 0),
    gstSecured: Number(posSummary._sum.amount ?? 0),
  };
}
