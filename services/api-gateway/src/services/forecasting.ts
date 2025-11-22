export type ObligationSample = {
  period: string; // e.g. "2025-Q1" or "2025-05"
  cents: number;
};

export type ForecastPoint = {
  period: string;
  meanCents: number;
  lowerCents: number;
  upperCents: number;
};

export type EwmaForecastOptions = {
  alpha?: number; // smoothing factor
  volatilityMultiplier?: number; // for confidence band
};

/**
 * Simple EWMA forecaster for obligations.
 */
export function ewmaForecast(
  history: ObligationSample[],
  horizonPeriods: number,
  options: EwmaForecastOptions = {},
): ForecastPoint[] {
  const alpha = options.alpha ?? 0.5;
  const volMult = options.volatilityMultiplier ?? 2;

  if (history.length === 0 || horizonPeriods <= 0) return [];

  const sorted = [...history].sort((a, b) =>
    a.period.localeCompare(b.period),
  );

  let mean = sorted[0]!.cents;
  let variance = 0;

  for (let i = 1; i < sorted.length; i += 1) {
    const x = sorted[i]!.cents;
    const prevMean = mean;
    mean = alpha * x + (1 - alpha) * mean;
    const diff = x - prevMean;
    variance = alpha * diff * diff + (1 - alpha) * variance;
  }

  const stdDev = Math.sqrt(variance);
  const points: ForecastPoint[] = [];

  const lastPeriod = sorted[sorted.length - 1]!.period;
  const [baseYearStr, baseSuffix] = lastPeriod.split("-");
  const baseYear = Number(baseYearStr);

  const nextPeriodLabel = (index: number): string => {
    if (baseSuffix?.startsWith("Q")) {
      const q = Number(baseSuffix.slice(1));
      const totalQ = q + index;
      const year = baseYear + Math.floor((totalQ - 1) / 4);
      const qNum = ((totalQ - 1) % 4) + 1;
      return `${year}-Q${qNum}`;
    }
    const baseMonth = Number(baseSuffix ?? "1");
    const totalM = baseMonth + index;
    const year = baseYear + Math.floor((totalM - 1) / 12);
    const month = ((totalM - 1) % 12) + 1;
    const mm = String(month).padStart(2, "0");
    return `${year}-${mm}`;
  };

  for (let i = 1; i <= horizonPeriods; i += 1) {
    const period = nextPeriodLabel(i);
    const meanCents = Math.round(mean);
    const delta = volMult * stdDev;
    const lowerCents = Math.max(0, Math.round(mean - delta));
    const upperCents = Math.round(mean + delta);
    points.push({ period, meanCents, lowerCents, upperCents });
  }

  return points;
}
