import type { PrismaClient } from "@prisma/client";

type BasCycleRecord = {
  paygwRequired: unknown;
  gstRequired: unknown;
};

export type ForecastResult = {
  paygwForecast: number;
  gstForecast: number;
  baselineCycles: number;
  trend: {
    paygwDelta: number;
    gstDelta: number;
  };
};

const DEFAULT_ALPHA = 0.6;

export async function forecastObligations(
  prisma: PrismaClient,
  orgId: string,
  lookback = 6,
  alpha = DEFAULT_ALPHA,
): Promise<ForecastResult> {
  const cycles = (await prisma.basCycle.findMany({
    where: { orgId },
    orderBy: { periodEnd: "desc" },
    take: lookback,
  })) as BasCycleRecord[];
  const count = cycles.length;
  if (count === 0) {
    return { paygwForecast: 0, gstForecast: 0, baselineCycles: 0, trend: { paygwDelta: 0, gstDelta: 0 } };
  }

  const paygwForecast = exponentialMovingAverage(
    cycles.map((cycle) => toNumber(cycle.paygwRequired)),
    alpha,
  );
  const gstForecast = exponentialMovingAverage(
    cycles.map((cycle) => toNumber(cycle.gstRequired)),
    alpha,
  );

  const xMean = (1 + count) / 2;
  const yPaygwMean = cycles.reduce((sum, cycle) => sum + toNumber(cycle.paygwRequired), 0) / count;
  const yGstMean = cycles.reduce((sum, cycle) => sum + toNumber(cycle.gstRequired), 0) / count;

  let numeratorPaygw = 0;
  let numeratorGst = 0;
  let denominator = 0;
  for (let i = 0; i < count; i += 1) {
    const x = i + 1;
    denominator += (x - xMean) ** 2;
    numeratorPaygw += (x - xMean) * (toNumber(cycles[i].paygwRequired) - yPaygwMean);
    numeratorGst += (x - xMean) * (toNumber(cycles[i].gstRequired) - yGstMean);
  }

  const deltaPaygw = denominator > 0 ? numeratorPaygw / denominator : 0;
  const deltaGst = denominator > 0 ? numeratorGst / denominator : 0;

  return {
    paygwForecast,
    gstForecast,
    baselineCycles: count,
    trend: {
      paygwDelta: deltaPaygw,
      gstDelta: deltaGst,
    },
  };
}

export function exponentialMovingAverage(series: number[], alpha = DEFAULT_ALPHA): number {
  if (series.length === 0) {
    return 0;
  }
  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < series.length; i += 1) {
    const weight = Math.pow(alpha, series.length - i - 1);
    weighted += series[i] * weight;
    weightSum += weight;
  }
  return weightSum ? weighted / weightSum : 0;
}

export type TierStatus = "reserve" | "automate" | "escalate";

export function computeTierStatus(balance: number, forecast: number, margin = 0): TierStatus {
  if (balance >= forecast + margin) {
    return "reserve";
  }
  if (balance >= forecast) {
    return "automate";
  }
  return "escalate";
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : 0;
}
