import type { PrismaClient } from "@prisma/client";

export type ForecastDiagnostics = {
  ewmaAlpha: number;
  paygwMean: number;
  gstMean: number;
  paygwStdDev: number;
  gstStdDev: number;
  anomalyUpperBound: {
    paygw: number;
    gst: number;
  };
};

export type ForecastResult = {
  paygwForecast: number;
  gstForecast: number;
  baselineCycles: number;
  trend: {
    paygwDelta: number;
    gstDelta: number;
  };
  diagnostics: ForecastDiagnostics;
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
    return {
      paygwForecast: 0,
      gstForecast: 0,
      baselineCycles: 0,
      trend: { paygwDelta: 0, gstDelta: 0 },
      diagnostics: {
        ewmaAlpha: alpha,
        paygwMean: 0,
        gstMean: 0,
        paygwStdDev: 0,
        gstStdDev: 0,
        anomalyUpperBound: { paygw: 0, gst: 0 },
      },
    };
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

  const paygwValues = cycles.map((cycle) => Number(cycle.paygwRequired));
  const gstValues = cycles.map((cycle) => Number(cycle.gstRequired));

  const paygwStdDev = standardDeviation(paygwValues, yPaygwMean);
  const gstStdDev = standardDeviation(gstValues, yGstMean);

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
    diagnostics: {
      ewmaAlpha: alpha,
      paygwMean: yPaygwMean,
      gstMean: yGstMean,
      paygwStdDev,
      gstStdDev,
      anomalyUpperBound: {
        paygw: yPaygwMean + paygwStdDev * 2,
        gst: yGstMean + gstStdDev * 2,
      },
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

function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0;
  }
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
