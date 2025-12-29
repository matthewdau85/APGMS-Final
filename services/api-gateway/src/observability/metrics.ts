import type { FastifyInstance } from "fastify";
import client from "prom-client";

type LabelValue = string | number;
type Labels = Record<string, LabelValue>;

const SERVICE_NAME = "apgms-api-gateway";
const METRIC_PREFIX = "apgms_";

export const registry = new client.Registry();
registry.setDefaultLabels({ service: SERVICE_NAME });

// Default process metrics (CPU, mem, GC, event loop, etc.)
client.collectDefaultMetrics({ register: registry });

function safeNowNs(): bigint {
  return process.hrtime.bigint();
}

function nsToSeconds(ns: bigint): number {
  return Number(ns) / 1_000_000_000;
}

function sanitizeLabels(metric: any, labels: any): any {
  if (!labels || typeof labels !== "object") return labels;
  const names: string[] | undefined = metric?.labelNames;
  if (!Array.isArray(names) || names.length === 0) return labels;

  const out: Record<string, LabelValue> = {};
  for (const k of names) {
    if (Object.prototype.hasOwnProperty.call(labels, k)) out[k] = labels[k];
  }
  return out;
}

function wrapMetric<T extends object>(metric: T): any {
  // Wrap to:
  // - bind methods correctly
  // - ignore unknown label keys (prevents prom-client runtime throws)
  // - tolerate unexpected method calls (no crash)
  return new Proxy(metric as any, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v === "function") {
        if (prop === "inc") {
          return (labels?: any, value?: number) => {
            try {
              if (labels && typeof labels === "object" && typeof value === "number") {
                return target.inc(sanitizeLabels(target, labels), value);
              }
              if (labels && typeof labels === "object") {
                return target.inc(sanitizeLabels(target, labels));
              }
              return target.inc(labels as any);
            } catch {
              return;
            }
          };
        }

        if (prop === "set") {
          return (labelsOrValue?: any, maybeValue?: number) => {
            try {
              // Gauge.set(labels, value) or Gauge.set(value)
              if (typeof maybeValue === "number") {
                return target.set(sanitizeLabels(target, labelsOrValue), maybeValue);
              }
              return target.set(labelsOrValue);
            } catch {
              return;
            }
          };
        }

        if (prop === "observe") {
          return (labelsOrValue?: any, maybeValue?: number) => {
            try {
              // Histogram.observe(labels, value) or .observe(value)
              if (typeof maybeValue === "number") {
                return target.observe(sanitizeLabels(target, labelsOrValue), maybeValue);
              }
              return target.observe(labelsOrValue);
            } catch {
              return;
            }
          };
        }

        if (prop === "startTimer") {
          return (labels?: any) => {
            try {
              const stop = target.startTimer(
                labels && typeof labels === "object" ? sanitizeLabels(target, labels) : labels,
              );
              return (endLabels?: any) => {
                try {
                  return stop(
                    endLabels && typeof endLabels === "object" ? sanitizeLabels(target, endLabels) : endLabels,
                  );
                } catch {
                  return;
                }
              };
            } catch {
              return () => {};
            }
          };
        }

        if (prop === "labels") {
          return (...args: any[]) => {
            try {
              const child = target.labels(...args);
              return wrapMetric(child);
            } catch {
              return wrapMetric(target);
            }
          };
        }

        return v.bind(target);
      }

      return v;
    },
  });
}

// --------------------
// Core HTTP metrics
// --------------------
export const httpRequestDurationSeconds = wrapMetric(
  new client.Histogram({
    name: `${METRIC_PREFIX}http_request_duration_seconds`,
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  }),
);

export const httpRequestsTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}http_requests_total`,
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  }),
);

// --------------------
// DB metrics
// --------------------
export const dbQueryDurationSeconds = wrapMetric(
  new client.Histogram({
    name: `${METRIC_PREFIX}db_query_duration_seconds`,
    help: "Database query duration in seconds",
    labelNames: ["model", "action", "status"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  }),
);

// --------------------
// Route-level business metrics (required by current route code)
// --------------------
export const atoReportsTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}ato_reports_total`,
    help: "ATO report send attempts",
    labelNames: ["status"],
    registers: [registry],
  }),
);

export const transferInstructionTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}transfer_instruction_total`,
    help: "Transfer instruction events",
    labelNames: ["status", "tax_type", "source"],
    registers: [registry],
  }),
);

export const paymentPlanRequestsTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}payment_plan_requests_total`,
    help: "Payment plan request events",
    labelNames: ["status"],
    registers: [registry],
  }),
);

export const basLodgmentsTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}bas_lodgments_total`,
    help: "BAS lodgment events",
    labelNames: ["status"],
    registers: [registry],
  }),
);

export const integrationEventDuration = wrapMetric(
  new client.Histogram({
    name: `${METRIC_PREFIX}integration_event_duration_seconds`,
    help: "Integration event processing duration in seconds",
    labelNames: ["event_type", "source", "status"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  }),
);

export const integrationDiscrepanciesTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}integration_discrepancies_total`,
    help: "Integration discrepancy events",
    labelNames: ["kind", "status", "source"],
    registers: [registry],
  }),
);

export const integrationEventsTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}integration_events_total`,
    help: "Integration events processed",
    labelNames: ["event_type", "status", "source"],
    registers: [registry],
  }),
);

export const obligationsTotal = wrapMetric(
  new client.Gauge({
    name: `${METRIC_PREFIX}obligations_total`,
    help: "Obligations total (count or cents depending on caller usage)",
    labelNames: ["orgId", "period", "tax_type", "source"],
    registers: [registry],
  }),
);

export const integrationAnomalyScore = wrapMetric(
  new client.Gauge({
    name: `${METRIC_PREFIX}integration_anomaly_score`,
    help: "Integration anomaly score (0..1 or arbitrary scale)",
    labelNames: ["orgId", "period", "source"],
    registers: [registry],
  }),
);

export const transferExecutionTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}transfer_execution_total`,
    help: "Transfer execution outcomes",
    labelNames: ["status"],
    registers: [registry],
  }),
);

// --------------------
// Business / compliance metrics (used across app)
// --------------------
export const settlementsFinalisedTotal = wrapMetric(
  new client.Counter({
    name: `${METRIC_PREFIX}settlements_finalised_total`,
    help: "Total number of finalised settlements",
    labelNames: ["orgId", "tax_type", "status", "source"],
    registers: [registry],
  }),
);

export const obligationsOutstandingCents = wrapMetric(
  new client.Gauge({
    name: `${METRIC_PREFIX}obligations_outstanding_cents`,
    help: "Outstanding obligations (cents)",
    labelNames: ["orgId", "tax_type", "source"],
    registers: [registry],
  }),
);

export const riskBandGauge = wrapMetric(
  new client.Gauge({
    name: `${METRIC_PREFIX}risk_band`,
    help: "Current risk band (1 for active band)",
    labelNames: ["orgId", "band"],
    registers: [registry],
  }),
);

export interface MetricsHandle {
  registry: client.Registry;
  installHttpMetrics: (app: FastifyInstance) => void;
  metricsText: () => Promise<string>;

  // Expose metrics used by routes/tests (fixes your TS2339 errors)
  httpRequestDurationSeconds: any;
  httpRequestsTotal: any;
  dbQueryDurationSeconds: any;

  atoReportsTotal: any;
  transferInstructionTotal: any;
  paymentPlanRequestsTotal: any;
  basLodgmentsTotal: any;

  integrationEventDuration: any;
  integrationDiscrepanciesTotal: any;
  integrationEventsTotal: any;
  obligationsTotal: any;
  integrationAnomalyScore: any;

  transferExecutionTotal: any;

  settlementsFinalisedTotal: any;
  obligationsOutstandingCents: any;
  riskBandGauge: any;
}

export function getMetrics(): MetricsHandle {
  return {
    registry,
    installHttpMetrics(app: FastifyInstance) {
      app.addHook("onRequest", async (req) => {
        (req as any).__apgms_start_ns = safeNowNs();
      });

      app.addHook("onResponse", async (req, reply) => {
        const start: bigint | undefined = (req as any).__apgms_start_ns;
        if (!start) return;

        const dur = nsToSeconds(safeNowNs() - start);

        const route =
          (req as any)?.routeOptions?.url ||
          (req as any)?.routerPath ||
          String(req.url || "/");

        const labels: Labels = {
          method: req.method,
          route: String(route),
          status_code: String(reply.statusCode),
        };

        httpRequestsTotal.inc(labels, 1);
        httpRequestDurationSeconds.observe(labels, dur);
      });
    },
    async metricsText() {
      return registry.metrics();
    },

    httpRequestDurationSeconds,
    httpRequestsTotal,
    dbQueryDurationSeconds,

    atoReportsTotal,
    transferInstructionTotal,
    paymentPlanRequestsTotal,
    basLodgmentsTotal,

    integrationEventDuration,
    integrationDiscrepanciesTotal,
    integrationEventsTotal,
    obligationsTotal,
    integrationAnomalyScore,

    transferExecutionTotal,

    settlementsFinalisedTotal,
    obligationsOutstandingCents,
    riskBandGauge,
  };
}

// Convenience singleton (so app.ts can import { metrics } and not re-init)
export const metrics = getMetrics();
