// services/forecasting/src/index.ts
// Simple EWMA-based forecasting for obligations.

export interface HistoryPoint {
  date: Date;
  value: number;
}

export interface ForecastResult {
  prediction: number;
  lower: number;
  upper: number;
}

/**
 * Forecast next obligation using a simple EWMA with a crude
 * confidence interval based on historical error.
 */
export function forecastObligation(history: HistoryPoint[]): ForecastResult {
  if (!history.length) {
    return { prediction: 0, lower: 0, upper: 0 };
  }

  const alpha = 0.5;
  let forecast = history[0].value;
  for (const point of history) {
    forecast = alpha * point.value + (1 - alpha) * forecast;
  }

  const errorSquaredSum = history.reduce((sum, p) => {
    const diff = p.value - forecast;
    return sum + diff * diff;
  }, 0);
  const variance = history.length > 1 ? errorSquaredSum / (history.length - 1) : 0;
  const stdDev = Math.sqrt(variance);

  return {
    prediction: forecast,
    lower: forecast - 1.96 * stdDev,
    upper: forecast + 1.96 * stdDev,
  };
}
