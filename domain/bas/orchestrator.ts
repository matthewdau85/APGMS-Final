import { Prisma, type PrismaClient } from "@prisma/client";

import { AppError } from "../../shared/src/errors.js";

type AuditLogger = (entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}) => Promise<void>;

export type BasOrchestrationContext = {
  prisma: PrismaClient;
  auditLogger?: AuditLogger;
};

export type BasOrchestrationSummary = {
  orgId: string;
  cyclesEvaluated: number;
  ready: number;
  blocked: number;
};

const SYSTEM_ACTOR = "system";

export async function orchestrateBasLodgment(
  context: BasOrchestrationContext,
  orgId: string,
): Promise<BasOrchestrationSummary> {
  const cycles = await context.prisma.basCycle.findMany({
    where: { orgId, lodgedAt: null },
    orderBy: { periodStart: "asc" },
  });

  if (cycles.length === 0) {
    return { orgId, cyclesEvaluated: 0, ready: 0, blocked: 0 };
  }

  const designatedAccounts = await context.prisma.designatedAccount.findMany({
    where: { orgId },
  });

  let remainingPaygwBalance = lookupBalance(designatedAccounts, "PAYGW");
  let remainingGstBalance = lookupBalance(designatedAccounts, "GST");

  let ready = 0;
  let blocked = 0;

  for (const cycle of cycles) {
    const requiredPaygw = toNumber(cycle.paygwRequired);
    const requiredGst = toNumber(cycle.gstRequired);

    const paygwAvailable = Math.max(0, remainingPaygwBalance);
    const gstAvailable = Math.max(0, remainingGstBalance);

    const paygwSecured = Math.min(requiredPaygw, paygwAvailable);
    const gstSecured = Math.min(requiredGst, gstAvailable);

    const paygwShortfall = Math.max(0, requiredPaygw - paygwSecured);
    const gstShortfall = Math.max(0, requiredGst - gstSecured);
    const status = paygwShortfall === 0 && gstShortfall === 0 ? "READY" : "BLOCKED";

    if (status === "READY") {
      ready += 1;
    } else {
      blocked += 1;
    }

    const updates: Record<string, unknown> = {};

    if (!decimalEquals(cycle.paygwSecured, paygwSecured)) {
      updates.paygwSecured = new Prisma.Decimal(paygwSecured);
    }

    if (!decimalEquals(cycle.gstSecured, gstSecured)) {
      updates.gstSecured = new Prisma.Decimal(gstSecured);
    }

    if (cycle.overallStatus !== status) {
      updates.overallStatus = status;
    }

    if (Object.keys(updates).length > 0) {
      await context.prisma.basCycle.update({
        where: { id: cycle.id },
        data: updates,
      });

      if (context.auditLogger) {
        await context.auditLogger({
          orgId,
          actorId: SYSTEM_ACTOR,
          action: "bas.orchestrated",
          metadata: {
            basCycleId: cycle.id,
            status,
            paygwSecured,
            gstSecured,
          },
        });
      }
    }

    await syncShortfallAlert(context.prisma, {
      orgId,
      type: "PAYGW_SHORTFALL",
      shortfall: paygwShortfall,
      message: paygwShortfall
        ? `PAYGW secured ${formatCurrency(paygwSecured)} below required ${formatCurrency(requiredPaygw)}.`
        : "PAYGW shortfall resolved.",
    });

    await syncShortfallAlert(context.prisma, {
      orgId,
      type: "GST_SHORTFALL",
      shortfall: gstShortfall,
      message: gstShortfall
        ? `GST secured ${formatCurrency(gstSecured)} below required ${formatCurrency(requiredGst)}.`
        : "GST shortfall resolved.",
    });

    remainingPaygwBalance = Math.max(0, remainingPaygwBalance - paygwSecured);
    remainingGstBalance = Math.max(0, remainingGstBalance - gstSecured);
  }

  return { orgId, cyclesEvaluated: cycles.length, ready, blocked };
}

function lookupBalance(
  accounts: Array<{ type: string; balance: Prisma.Decimal }>,
  type: string,
): number {
  const account = accounts.find((entry) => entry.type.toUpperCase() === type.toUpperCase());
  if (!account) {
    return 0;
  }
  return toNumber(account.balance);
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (value === null || value === undefined) {
    return 0;
  }
  throw new AppError(500, "bas_invalid_decimal", "Unable to convert decimal value to number");
}

function decimalEquals(value: Prisma.Decimal, expected: number): boolean {
  if (!(value instanceof Prisma.Decimal)) {
    return false;
  }
  return value.toDecimalPlaces(2).equals(new Prisma.Decimal(expected).toDecimalPlaces(2));
}

type ShortfallAlertInput = {
  orgId: string;
  type: string;
  shortfall: number;
  message: string;
};

async function syncShortfallAlert(
  prisma: PrismaClient,
  input: ShortfallAlertInput,
): Promise<void> {
  const existing = await prisma.alert.findFirst({
    where: { orgId: input.orgId, type: input.type, resolvedAt: null },
  });

  if (input.shortfall > 0) {
    if (existing) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: { message: input.message },
      });
      return;
    }

    await prisma.alert.create({
      data: {
        orgId: input.orgId,
        type: input.type,
        severity: "HIGH",
        message: input.message,
      },
    });
    return;
  }

  if (existing) {
    await prisma.alert.update({
      where: { id: existing.id },
      data: { resolvedAt: new Date(), resolutionNote: "Auto-resolved by BAS orchestrator" },
    });
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    Math.round(amount * 100) / 100,
  );
}
