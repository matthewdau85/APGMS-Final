import type { PrismaClient } from "@prisma/client";

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
  const cycles = await prisma.basCycle.findMany({
    where: { orgId },
    orderBy: { periodEnd: "desc" },
    take: lookback,
  });
  const count = cycles.length;
  if (count === 0) {
    return { paygwForecast: 0, gstForecast: 0, baselineCycles: 0, trend: { paygwDelta: 0, gstDelta: 0 } };
  }

  let weightedPaygw = 0;
  let weightedGst = 0;
  let weightSum = 0;

  for (let i = 0; i < count; i += 1) {
    const weight = Math.pow(alpha, count - i - 1);
    weightedPaygw += Number(cycles[i].paygwRequired) * weight;
    weightedGst += Number(cycles[i].gstRequired) * weight;
    weightSum += weight;
  }

  const paygwForecast = weightSum ? weightedPaygw / weightSum : 0;
  const gstForecast = weightSum ? weightedGst / weightSum : 0;

  const xMean = (1 + count) / 2;
  const yPaygwMean = cycles.reduce((sum, cycle) => sum + Number(cycle.paygwRequired), 0) / count;
  const yGstMean = cycles.reduce((sum, cycle) => sum + Number(cycle.gstRequired), 0) / count;

  let numeratorPaygw = 0;
  let numeratorGst = 0;
  let denominator = 0;
  for (let i = 0; i < count; i += 1) {
    const x = i + 1;
    denominator += (x - xMean) ** 2;
    numeratorPaygw += (x - xMean) * (Number(cycles[i].paygwRequired) - yPaygwMean);
    numeratorGst += (x - xMean) * (Number(cycles[i].gstRequired) - yGstMean);
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
