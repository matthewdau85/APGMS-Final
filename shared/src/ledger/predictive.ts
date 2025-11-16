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
  const yPaygwMean =
    cycles.reduce<number>((sum, cycle) => sum + Number(cycle.paygwRequired), 0) /
    count;
  const yGstMean =
    cycles.reduce<number>((sum, cycle) => sum + Number(cycle.gstRequired), 0) / count;

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

export type CalibrationSample = {
  actualPaygw: number;
  forecastPaygw: number;
  actualGst: number;
  forecastGst: number;
};

export type CalibrationResult = {
  bias: {
    paygw: number;
    gst: number;
  };
  mape: {
    paygw: number;
    gst: number;
  };
  recommendedMargin: number;
  recommendedAlpha: number;
};

export type ForecastConfidence = "high" | "medium" | "low";

export type ForecastNarrative = {
  summary: string;
  highlights: string[];
  recommendedActions: string[];
  confidence: ForecastConfidence;
};

export function calibrateForecastEngine(
  samples: CalibrationSample[],
): CalibrationResult {
  if (samples.length === 0) {
    return {
      bias: { paygw: 0, gst: 0 },
      mape: { paygw: 0, gst: 0 },
      recommendedMargin: 0,
      recommendedAlpha: DEFAULT_ALPHA,
    };
  }

  let biasPaygw = 0;
  let biasGst = 0;
  let mapePaygw = 0;
  let mapeGst = 0;

  for (const sample of samples) {
    biasPaygw += sample.actualPaygw - sample.forecastPaygw;
    biasGst += sample.actualGst - sample.forecastGst;

    mapePaygw += Math.abs(sample.actualPaygw - sample.forecastPaygw) /
      Math.max(1, Math.abs(sample.actualPaygw));
    mapeGst += Math.abs(sample.actualGst - sample.forecastGst) /
      Math.max(1, Math.abs(sample.actualGst));
  }

  biasPaygw /= samples.length;
  biasGst /= samples.length;
  mapePaygw /= samples.length;
  mapeGst /= samples.length;

  const recommendedMargin = Math.round(
    Math.max(Math.abs(biasPaygw), Math.abs(biasGst)) * (1 + (mapePaygw + mapeGst) / 2),
  );

  let recommendedAlpha = DEFAULT_ALPHA;
  const avgMape = (mapePaygw + mapeGst) / 2;
  if (avgMape > 0.25) {
    recommendedAlpha = 0.4;
  } else if (avgMape < 0.1) {
    recommendedAlpha = 0.75;
  }

  return {
    bias: { paygw: biasPaygw, gst: biasGst },
    mape: { paygw: mapePaygw, gst: mapeGst },
    recommendedMargin,
    recommendedAlpha,
  };
}

export function applyCalibration(
  forecast: ForecastResult,
  calibration: CalibrationResult,
): ForecastResult {
  return {
    ...forecast,
    paygwForecast: forecast.paygwForecast + calibration.bias.paygw,
    gstForecast: forecast.gstForecast + calibration.bias.gst,
  };
}

function resolveConfidence(
  forecast: ForecastResult,
  calibration?: CalibrationResult,
): ForecastConfidence {
  const avgMape = calibration
    ? (calibration.mape.paygw + calibration.mape.gst) / 2
    : 0.15;
  if (forecast.baselineCycles >= 6 && avgMape <= 0.1) {
    return "high";
  }
  if (forecast.baselineCycles >= 3 && avgMape <= 0.2) {
    return "medium";
  }
  return "low";
}

export function buildForecastNarrative(
  forecast: ForecastResult,
  calibration?: CalibrationResult,
): ForecastNarrative {
  const confidence = resolveConfidence(forecast, calibration);
  const paygwDirection = forecast.trend.paygwDelta >= 0 ? "rising" : "falling";
  const gstDirection = forecast.trend.gstDelta >= 0 ? "rising" : "falling";

  const highlights = [
    `PAYGW forecast: ${forecast.paygwForecast.toFixed(2)}`,
    `GST forecast: ${forecast.gstForecast.toFixed(2)}`,
    `Trend deltas — PAYGW: ${forecast.trend.paygwDelta.toFixed(2)}, GST: ${forecast.trend.gstDelta.toFixed(2)}`,
    `Baseline cycles analysed: ${forecast.baselineCycles}`,
  ];

  if (calibration) {
    highlights.push(
      `Calibration margin: ${calibration.recommendedMargin} | recommended alpha: ${calibration.recommendedAlpha}`,
    );
  }

  const recommendedActions: string[] = [];
  if (confidence === "high") {
    recommendedActions.push(
      "Auto-reconcile PAYGW and GST transfers using the reserve tier with zero-touch approvals",
    );
  } else if (confidence === "medium") {
    recommendedActions.push(
      "Enable automation but keep escalation alerts enabled for GST deltas beyond the recommended margin",
    );
  } else {
    recommendedActions.push(
      "Escalate to finance ops for manual validation and increase reserve funding for next cycle",
    );
  }

  const summary = `PAYGW obligations are ${paygwDirection} while GST is ${gstDirection}; confidence is ${confidence.toUpperCase()}.`;

  return { summary, highlights, recommendedActions, confidence };
}

export function deriveCalibrationFromCsv(csv: string): CalibrationResult {
  const rows = csv
    .split(/\r?\n/g)
    .map((row) => row.trim())
    .filter((row) => row && !row.startsWith("#"));
  if (rows.length === 0) {
    return calibrateForecastEngine([]);
  }

  const [header, ...dataRows] = rows;
  const columns = header.split(",").map((value) => value.trim().toLowerCase());

  const idx = {
    actualPaygw: columns.indexOf("actual_paygw"),
    forecastPaygw: columns.indexOf("forecast_paygw"),
    actualGst: columns.indexOf("actual_gst"),
    forecastGst: columns.indexOf("forecast_gst"),
  };

  const missing = Object.entries(idx)
    .filter(([, value]) => value === -1)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`CSV missing columns: ${missing.join(", ")}`);
  }

  const samples: CalibrationSample[] = [];
  for (const row of dataRows) {
    const parts = row.split(",");
    const sample = {
      actualPaygw: Number(parts[idx.actualPaygw]),
      forecastPaygw: Number(parts[idx.forecastPaygw]),
      actualGst: Number(parts[idx.actualGst]),
      forecastGst: Number(parts[idx.forecastGst]),
    };
    if (Object.values(sample).some((value) => Number.isNaN(value))) {
      continue;
    }
    samples.push(sample);
  }

  return calibrateForecastEngine(samples);
}
