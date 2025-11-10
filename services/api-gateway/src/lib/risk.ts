import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import {
  type FraudRiskInput,
  type MlServiceClient,
  type RiskAssessment,
  type ShortfallRiskInput,
} from "../clients/mlServiceClient.js";

const DECIMAL_ZERO = new Prisma.Decimal(0);

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value);
}

function sumDecimal(values: Array<Prisma.Decimal>): number {
  return values.reduce((acc, value) => acc + Number(value), 0);
}

export async function buildShortfallRiskInput(orgId: string | null): Promise<ShortfallRiskInput> {
  const [accounts, upcomingCycle, openHighAlerts] = await Promise.all([
    prisma.designatedAccount.findMany({
      where: orgId ? { orgId } : undefined,
      select: { balance: true },
    }),
    prisma.basCycle.findFirst({
      where: orgId ? { orgId } : undefined,
      orderBy: { periodEnd: "desc" },
    }),
    prisma.alert.count({
      where: {
        severity: "HIGH",
        resolvedAt: null,
        ...(orgId ? { orgId } : {}),
      },
    }),
  ]);

  const cashOnHand = sumDecimal(accounts.map((account) => account.balance));

  const upcomingObligations = upcomingCycle
    ? Number(upcomingCycle.paygwRequired ?? DECIMAL_ZERO) +
      Number(upcomingCycle.gstRequired ?? DECIMAL_ZERO)
    : 0;

  const secured = upcomingCycle
    ? Number(upcomingCycle.paygwSecured ?? DECIMAL_ZERO) +
      Number(upcomingCycle.gstSecured ?? DECIMAL_ZERO)
    : 0;

  const lodgmentCompletionRatio = upcomingObligations > 0 ? Math.min(secured / upcomingObligations, 1) : 1;

  const volatilityIndex = upcomingCycle
    ? Math.abs(upcomingObligations - secured - cashOnHand) / (upcomingObligations + 1)
    : 0;

  return {
    orgId: orgId ?? "system",
    cashOnHand,
    upcomingObligations,
    openHighAlerts,
    lodgmentCompletionRatio,
    volatilityIndex,
  };
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function buildFraudRiskInput(
  orgId: string,
  amount: number,
  settlementDate: Date,
  payeeFingerprint: string,
): Promise<FraudRiskInput> {
  const [avgAmount, sameDayCount, payeeCount, totalCount, recentCount] = await Promise.all([
    prisma.bankLine.aggregate({
      where: { orgId },
      _avg: { amount: true },
    }),
    prisma.bankLine.count({
      where: {
        orgId,
        date: {
          gte: startOfDay(settlementDate),
          lt: addDays(settlementDate, 1),
        },
      },
    }),
    prisma.bankLine.count({
      where: { orgId, payeeCiphertext: payeeFingerprint },
    }),
    prisma.bankLine.count({ where: { orgId } }),
    prisma.bankLine.count({
      where: {
        orgId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const rollingAverageAmount = decimalToNumber(avgAmount._avg?.amount ?? DECIMAL_ZERO);
  const payeeConcentration = totalCount > 0 ? payeeCount / totalCount : 0;

  return {
    orgId,
    amount,
    rollingAverageAmount,
    sameDayCount,
    payeeConcentration,
    recentVelocity: recentCount,
  };
}

export function shouldDeferReadiness(risk: RiskAssessment | null | undefined): boolean {
  return (risk?.riskLevel ?? "low") === "high";
}

export function shouldBlockTransfer(risk: RiskAssessment | null | undefined): boolean {
  return (risk?.riskLevel ?? "low") === "high";
}

export async function fetchShortfallRisk(
  client: MlServiceClient,
  orgId: string | null,
): Promise<RiskAssessment | null> {
  try {
    const payload = await buildShortfallRiskInput(orgId);
    return await client.evaluateShortfallRisk(payload);
  } catch (error) {
    return null;
  }
}

export async function fetchFraudRisk(
  client: MlServiceClient,
  options: {
    orgId: string;
    amount: number;
    settlementDate: Date;
    payeeFingerprint: string;
  },
): Promise<RiskAssessment | null> {
  try {
    const payload = await buildFraudRiskInput(
      options.orgId,
      options.amount,
      options.settlementDate,
      options.payeeFingerprint,
    );
    return await client.evaluateFraudRisk(payload);
  } catch (error) {
    return null;
  }
}
