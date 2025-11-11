import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { scoreScenario, type PolicyEvaluation } from "./ml-client.js";

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  return Number.parseFloat(value.toString());
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

async function countAlerts(orgId: string, severity?: string) {
  return prisma.alert.count({
    where: {
      orgId,
      resolvedAt: null,
      ...(severity ? { severity } : {}),
    },
  });
}

export async function evaluateBasReadiness(orgId: string): Promise<PolicyEvaluation & {
  features: Record<string, number>;
}> {
  const basCycle = await prisma.basCycle.findFirst({
    where: { orgId, lodgedAt: null },
    orderBy: { periodEnd: "desc" },
  });

  const now = new Date();
  const paygwRequired = decimalToNumber(basCycle?.paygwRequired);
  const paygwSecured = decimalToNumber(basCycle?.paygwSecured);
  const gstRequired = decimalToNumber(basCycle?.gstRequired);
  const gstSecured = decimalToNumber(basCycle?.gstSecured);

  const paygwShortfall = Math.max(0, paygwRequired - paygwSecured);
  const gstShortfall = Math.max(0, gstRequired - gstSecured);
  const outstandingAlerts = await countAlerts(orgId, "HIGH");

  const dueDate = basCycle
    ? new Date(new Date(basCycle.periodEnd).getTime() + 28 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysToDue = Math.max(0, Math.round(msUntilDue / (24 * 60 * 60 * 1000)));

  const planWindowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentPlanRequests = await prisma.paymentPlanRequest.count({
    where: {
      orgId,
      requestedAt: { gte: planWindowStart },
    },
  });

  const features = {
    paygwShortfall,
    gstShortfall,
    outstandingAlerts,
    daysToDue,
    recentPlanRequests,
  };

  const evaluation = await scoreScenario("shortfall", {
    features,
    context: { orgId },
  });

  return { ...evaluation, features };
}

export async function evaluateFraudSignals(orgId: string): Promise<PolicyEvaluation & {
  features: Record<string, number>;
}> {
  const [highSeverityAlerts, reviewAlerts, basCycle, designatedAccounts] = await Promise.all([
    countAlerts(orgId, "HIGH"),
    prisma.alert.count({
      where: {
        orgId,
        resolvedAt: null,
        OR: [
          { type: { contains: "FRAUD" } },
          { type: { contains: "VENDOR" } },
          { type: { contains: "PAYMENT" } },
        ],
      },
    }),
    prisma.basCycle.findFirst({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "desc" },
    }),
    prisma.designatedAccount.findMany({
      where: { orgId },
      select: { balance: true },
    }),
  ]);

  const totalDesignated = designatedAccounts.reduce(
    (acc, entry) => acc + decimalToNumber(entry.balance),
    0,
  );

  const secured =
    decimalToNumber(basCycle?.paygwSecured) + decimalToNumber(basCycle?.gstSecured);
  const suddenBalanceShift = Math.abs(totalDesignated - secured);

  const recentBankLines = await prisma.bankLine.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const amounts = recentBankLines.map((line) => decimalToNumber(line.amount));
  const mean = amounts.length > 0 ? amounts.reduce((acc, val) => acc + val, 0) / amounts.length : 0;
  const variance =
    amounts.length > 1
      ? amounts.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (amounts.length - 1)
      : 0;
  const bankLineVariance = Math.sqrt(Math.max(variance, 0));

  const auditWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const manualOverrides = await prisma.auditLog.count({
    where: {
      orgId,
      action: { in: ["bas.override", "payments.override"] },
      createdAt: { gte: auditWindow },
    },
  });

  const features = {
    highSeverityAlerts,
    suddenBalanceShift,
    bankLineVariance,
    unusualVendors: reviewAlerts,
    manualOverrides,
  };

  const evaluation = await scoreScenario("fraud", {
    features,
    context: { orgId },
  });

  return { ...evaluation, features };
}

export async function evaluatePlanCompliance(orgId: string): Promise<PolicyEvaluation & {
  features: Record<string, number>;
  paymentPlanId: string | null;
}> {
  const now = new Date();
  const latestPlan = await prisma.paymentPlanRequest.findFirst({
    where: { orgId },
    orderBy: { requestedAt: "desc" },
  });

  const basCycle = latestPlan
    ? await prisma.basCycle.findUnique({ where: { id: latestPlan.basCycleId } })
    : await prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      });

  const designated = await prisma.designatedAccount.findMany({
    where: { orgId },
    select: { balance: true },
  });

  const totalDesignated = designated.reduce(
    (acc, entry) => acc + decimalToNumber(entry.balance),
    0,
  );
  const requiredTotal =
    decimalToNumber(basCycle?.paygwRequired) + decimalToNumber(basCycle?.gstRequired);

  const openShortfalls = await prisma.alert.count({
    where: {
      orgId,
      resolvedAt: null,
      type: { contains: "SHORTFALL" },
    },
  });

  const delinquencyDays = latestPlan && !latestPlan.resolvedAt
    ? Math.max(
        0,
        Math.round((now.getTime() - latestPlan.requestedAt.getTime()) / (24 * 60 * 60 * 1000)),
      )
    : 0;

  const planCoverage = latestPlan
    ? Number.parseFloat(
        (latestPlan.detailsJson as any)?.installmentCoverage ?? "0",
      ) || safeRatio(totalDesignated, requiredTotal)
    : safeRatio(totalDesignated, requiredTotal);

  const governanceScore = Math.max(
    0,
    1 - safeRatio(openShortfalls + (await countAlerts(orgId)), 20),
  );

  const features = {
    planDelinquencyDays: delinquencyDays,
    installmentCoverage: Number(planCoverage.toFixed(3)),
    recentShortfalls: openShortfalls,
    cashCoverageRatio: Number(safeRatio(totalDesignated, requiredTotal || 1).toFixed(3)),
    governanceScore: Number(governanceScore.toFixed(3)),
  };

  const evaluation = await scoreScenario("plan", {
    features,
    context: { orgId, paymentPlanId: latestPlan?.id },
  });

  return { ...evaluation, features, paymentPlanId: latestPlan?.id ?? null };
}
