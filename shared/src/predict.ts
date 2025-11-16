import type { PrismaClient } from "@prisma/client";

import { prisma } from "./db.js";

export type TaxPrediction = {
  gstEstimate: number;
  paygwEstimate: number;
  confidence: number;
};

const LOOKBACK_MONTHS = 12;
const ROLLING_WINDOW_MONTHS = 3;
const DAYS_PER_MONTH = 30;
const MAX_FORECAST_DAYS = 180;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampDays(daysAhead: number): number {
  if (!Number.isFinite(daysAhead) || daysAhead <= 0) {
    return 1;
  }
  return Math.min(MAX_FORECAST_DAYS, Math.max(1, Math.floor(daysAhead)));
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${month.toString().padStart(2, "0")}`;
}

function computeRollingAverage(values: number[]): { average: number; variance: number } {
  if (values.length === 0) {
    return { average: 0, variance: 0 };
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  const average = sum / values.length;
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - average, 2), 0) /
    values.length;
  return { average, variance };
}

function applyConfidence(variance: number, baseline: number): number {
  if (baseline <= 0) {
    return 0.3;
  }
  const varianceRatio = variance / baseline;
  const confidence = 1 / (1 + varianceRatio);
  return Math.max(0.3, Math.min(0.99, confidence));
}

export async function predictTaxObligations(
  orgId: string,
  daysAhead: number,
  prismaClient: PrismaClient = prisma,
): Promise<TaxPrediction> {
  const clampedDaysAhead = clampDays(daysAhead);
  const asOf = new Date();
  const lookback = new Date(asOf.getTime());
  lookback.setMonth(lookback.getMonth() - LOOKBACK_MONTHS);

  const [gstTransactions, payrollItems] = await Promise.all([
    prismaClient.gstTransaction.findMany({
      where: {
        orgId,
        txDate: { gte: lookback, lte: asOf },
      },
    }),
    prismaClient.payrollItem.findMany({
      where: {
        orgId,
        payPeriodEnd: { gte: lookback, lte: asOf },
      },
    }),
  ]);

  const gstByMonth = new Map<string, number>();
  for (const entry of gstTransactions) {
    const key = monthKey(entry.txDate);
    const amount = Number(entry.gstCents ?? 0) / 100;
    gstByMonth.set(key, (gstByMonth.get(key) ?? 0) + amount);
  }

  const paygwByMonth = new Map<string, number>();
  for (const item of payrollItems) {
    const key = monthKey(item.payPeriodEnd);
    const amount = Number(item.paygwCents ?? 0) / 100;
    paygwByMonth.set(key, (paygwByMonth.get(key) ?? 0) + amount);
  }

  const sortedMonths = Array.from(
    new Set([...gstByMonth.keys(), ...paygwByMonth.keys()]),
  ).sort();
  const windowMonths = sortedMonths.slice(-ROLLING_WINDOW_MONTHS);

  const gstWindowValues = windowMonths.map((key) => gstByMonth.get(key) ?? 0);
  const paygwWindowValues = windowMonths.map((key) => paygwByMonth.get(key) ?? 0);

  const gstStats = computeRollingAverage(gstWindowValues);
  const paygwStats = computeRollingAverage(paygwWindowValues);

  const perDayGst = gstStats.average / DAYS_PER_MONTH;
  const perDayPaygw = paygwStats.average / DAYS_PER_MONTH;

  const gstEstimate = roundCurrency(perDayGst * clampedDaysAhead);
  const paygwEstimate = roundCurrency(perDayPaygw * clampedDaysAhead);

  const confidence =
    windowMonths.length === 0
      ? 0.3
      : Math.min(
          applyConfidence(gstStats.variance, gstStats.average || 1),
          applyConfidence(paygwStats.variance, paygwStats.average || 1),
        );

  return {
    gstEstimate,
    paygwEstimate,
    confidence: roundCurrency(confidence),
  };
}
