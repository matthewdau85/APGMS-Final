import { Decimal } from "@prisma/client/runtime/library";
import type { PrismaClient } from "@prisma/client";
import { withIdempotency } from "../idempotency.js";
import { getDesignatedAccountByType } from "./designated-account.js";
import { applyDesignatedAccountTransfer, type AuditLogger } from "@apgms/domain-policy";

export type SecuringSchedule = "daily" | "weekly";
const DEFAULT_SCHEDULE: SecuringSchedule = "weekly";

export type PendingContributionRecord = {
  id: string;
  amount: Decimal;
  createdAt: Date;
  source: string;
};

export type AggregatedContributionBatch = {
  batchStart: Date;
  totalAmount: Decimal;
  source: string;
  contributionIds: string[];
};

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

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const start = startOfUtcDay(date);
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  start.setUTCDate(start.getUTCDate() + diff);
  return startOfUtcDay(start);
}

export function aggregatePendingContributionBatches(
  entries: PendingContributionRecord[],
  schedule: SecuringSchedule,
  now: Date = new Date(),
): AggregatedContributionBatch[] {
  const boundary =
    schedule === "daily" ? startOfUtcDay(now) : startOfUtcWeek(now);
  const batches = new Map<string, AggregatedContributionBatch>();

  for (const entry of entries) {
    const bucketStart =
      schedule === "daily"
        ? startOfUtcDay(entry.createdAt)
        : startOfUtcWeek(entry.createdAt);
    if (bucketStart >= boundary) {
      continue;
    }
    const key = `${entry.source}:${bucketStart.toISOString()}`;
    const existing = batches.get(key);
    if (existing) {
      existing.totalAmount = existing.totalAmount.add(entry.amount);
      existing.contributionIds.push(entry.id);
    } else {
      batches.set(key, {
        batchStart: bucketStart,
        totalAmount: new Decimal(entry.amount),
        source: entry.source,
        contributionIds: [entry.id],
      });
    }
  }

  return Array.from(batches.values()).sort(
    (a, b) => a.batchStart.getTime() - b.batchStart.getTime(),
  );
}

export async function applyPendingContributions(params: {
  prisma: PrismaClient;
  orgId: string;
  actorId?: string;
  auditLogger?: AuditLogger;
  securingSchedule?: SecuringSchedule;
}): Promise<ContributionResult> {
  const schedule = params.securingSchedule ?? DEFAULT_SCHEDULE;
  const pendingPayroll = await params.prisma.payrollContribution.findMany({
    where: { orgId: params.orgId, appliedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const pendingPos = await params.prisma.posTransaction.findMany({
    where: { orgId: params.orgId, appliedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const payrollBatches = aggregatePendingContributionBatches(
    pendingPayroll.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      createdAt: entry.createdAt,
      source: entry.source,
    })),
    schedule,
  );
  const posBatches = aggregatePendingContributionBatches(
    pendingPos.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      createdAt: entry.createdAt,
      source: entry.source,
    })),
    schedule,
  );

  const context = { prisma: params.prisma, auditLogger: params.auditLogger };
  const actorId = params.actorId ?? "system";
  let payrollApplied = 0;
  let posApplied = 0;

  for (const batch of payrollBatches) {
    const applied = await applyAggregatedContribution(batch, {
      orgId: params.orgId,
      accountType: "PAYGW_BUFFER",
      actorId,
      context,
      table: "payroll",
    });
    if (applied) {
      payrollApplied += batch.contributionIds.length;
    }
  }

  for (const batch of posBatches) {
    const applied = await applyAggregatedContribution(batch, {
      orgId: params.orgId,
      accountType: "GST_BUFFER",
      actorId,
      context,
      table: "pos",
    });
    if (applied) {
      posApplied += batch.contributionIds.length;
    }
  }

  return {
    payrollApplied,
    posApplied,
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

async function applyAggregatedContribution(
  batch: AggregatedContributionBatch,
  params: ApplyContributionContext,
): Promise<boolean> {
  if (batch.totalAmount.isZero()) {
    return false;
  }
  const account = await getDesignatedAccountByType(
    params.context.prisma,
    params.orgId,
    params.accountType,
  );
  const amount = Number(batch.totalAmount.toString());
  const transfer = await applyDesignatedAccountTransfer(
    {
      prisma: params.context.prisma,
      auditLogger: params.context.auditLogger,
    },
    {
      orgId: params.orgId,
      accountId: account.id,
      amount,
      source: batch.source,
      actorId: params.actorId,
    },
  );

  const appliedAt = new Date();
  if (params.table === "payroll") {
    await params.context.prisma.payrollContribution.updateMany({
      where: { id: { in: batch.contributionIds } },
      data: {
        appliedAt,
        transferId: transfer.transferId,
      },
    });
  } else {
    await params.context.prisma.posTransaction.updateMany({
      where: { id: { in: batch.contributionIds } },
      data: {
        appliedAt,
        transferId: transfer.transferId,
      },
    });
  }

  return true;
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
