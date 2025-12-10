export type ObligationSample = {
    period: string;
    cents: number;
};
export type ForecastPoint = {
    period: string;
    meanCents: number;
    lowerCents: number;
    upperCents: number;
};
export type EwmaForecastOptions = {
    alpha?: number;
    volatilityMultiplier?: number;
};
/**
 * Simple EWMA forecaster for obligations.
 */
export declare function ewmaForecast(history: ObligationSample[], horizonPeriods: number, options?: EwmaForecastOptions): ForecastPoint[];
//# sourceMappingURL=forecasting.d.ts.map