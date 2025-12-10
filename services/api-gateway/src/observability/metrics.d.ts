import type { FastifyInstance } from 'fastify';
import { Counter, Histogram, Gauge, register as promRegister } from 'prom-client';
export declare const metrics: {
    httpRequestTotal: Counter<"status" | "method" | "route">;
    httpRequestDuration: Histogram<"status" | "method" | "route">;
    dbQueryDuration: Histogram<"model" | "operation">;
    dbQueryTotal: Counter<"status" | "model" | "operation">;
    jobDuration: Histogram<"job">;
    integrationEventDuration: Histogram<"status" | "tax_type">;
    integrationEventsTotal: Counter<"status" | "tax_type">;
    integrationDiscrepanciesTotal: Counter<"tax_type" | "severity">;
    obligationsTotal: Gauge<"tax_type">;
    integrationAnomalyScore: Gauge<"tax_type" | "severity">;
    basLodgmentsTotal: Counter<"status">;
    transferInstructionTotal: Counter<"status" | "tax_type">;
    transferExecutionTotal: Counter<"status">;
    paymentPlanRequestsTotal: Counter<"status">;
    atoReportsTotal: Counter<"status">;
    riskEventsTotal: Counter<"severity">;
    observeJob<T>(job: string, fn: () => Promise<T>): Promise<T>;
};
export { promRegister };
export declare function registerMetricsRoute(app: FastifyInstance): void;
export declare function installHttpMetrics(app: FastifyInstance): void;
//# sourceMappingURL=metrics.d.ts.map