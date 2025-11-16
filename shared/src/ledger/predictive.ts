import type { PrismaClient } from "@prisma/client";

export type ForecastConfidenceInterval = {
  lower: number;
  upper: number;
  standardDeviation: number;
  sampleSize: number;
};

export type SeriesForecastDetail = {
  forecast: number;
  trendDelta: number;
  confidence: ForecastConfidenceInterval;
};

export type ForecastResult = {
  paygwForecast: number;
  gstForecast: number;
  baselineCycles: number;
  trend: {
    paygwDelta: number;
    gstDelta: number;
  };
  intervals: {
    paygw: ForecastConfidenceInterval;
    gst: ForecastConfidenceInterval;
  };
};

const DEFAULT_ALPHA = 0.6;

function createEmptyConfidence(): ForecastConfidenceInterval {
  return { lower: 0, upper: 0, standardDeviation: 0, sampleSize: 0 };
}

function computeConfidenceInterval(values: number[], forecast: number): ForecastConfidenceInterval {
  if (values.length <= 1) {
    return { lower: Math.max(0, forecast), upper: Math.max(0, forecast), standardDeviation: 0, sampleSize: values.length };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);
  const standardDeviation = Math.sqrt(variance);
  const margin = 1.96 * (standardDeviation / Math.sqrt(values.length));
  return {
    lower: Math.max(0, forecast - margin),
    upper: Math.max(0, forecast + margin),
    standardDeviation,
    sampleSize: values.length,
  };
}

function computeRegressionDelta(values: number[]): number {
  const count = values.length;
  if (count <= 1) {
    return 0;
  }
  const xMean = (1 + count) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < count; i += 1) {
    const x = i + 1;
    numerator += (x - xMean) * (values[i] - yMean);
    denominator += (x - xMean) ** 2;
  }
  return denominator > 0 ? numerator / denominator : 0;
}

export function analyzeSeries(values: number[], alpha = DEFAULT_ALPHA): SeriesForecastDetail {
  if (values.length === 0) {
    return { forecast: 0, trendDelta: 0, confidence: createEmptyConfidence() };
  }

  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const weight = Math.pow(alpha, values.length - i - 1);
    weighted += values[i] * weight;
    weightSum += weight;
  }

  const forecast = weightSum ? weighted / weightSum : 0;
  const trendDelta = computeRegressionDelta(values);
  const confidence = computeConfidenceInterval(values, forecast);
  return { forecast, trendDelta, confidence };
}

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
      intervals: { paygw: createEmptyConfidence(), gst: createEmptyConfidence() },
    };
  }
  const paygwSeries = cycles.map((cycle) => Number(cycle.paygwRequired));
  const gstSeries = cycles.map((cycle) => Number(cycle.gstRequired));
  const paygwDetail = analyzeSeries(paygwSeries, alpha);
  const gstDetail = analyzeSeries(gstSeries, alpha);

  return {
    paygwForecast: paygwDetail.forecast,
    gstForecast: gstDetail.forecast,
    baselineCycles: count,
    trend: {
      paygwDelta: paygwDetail.trendDelta,
      gstDelta: gstDetail.trendDelta,
    },
    intervals: {
      paygw: paygwDetail.confidence,
      gst: gstDetail.confidence,
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
