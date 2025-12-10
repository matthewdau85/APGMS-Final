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
export declare function forecastObligations(prisma: PrismaClient, orgId: string, lookback?: number, alpha?: number): Promise<ForecastResult>;
export type TierStatus = "reserve" | "automate" | "escalate";
export declare function computeTierStatus(balance: number, forecast: number, margin?: number): TierStatus;
//# sourceMappingURL=predictive.d.ts.map