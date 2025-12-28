import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

let registry: Registry | null = null;
let metrics: ReturnType<typeof createMetrics> | null = null;

function createMetrics(registry: Registry) {
  return {
    // HTTP
    httpRequestTotal: new Counter({
      name: "apgms_http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [registry],
    }),

    httpRequestDuration: new Histogram({
      name: "apgms_http_request_duration_seconds",
      help: "HTTP request duration",
      labelNames: ["method", "route", "status_code"],
      registers: [registry],
    }),

    // DB
    dbQueryDurationSeconds: new Histogram({
      name: "apgms_db_query_duration_seconds",
      help: "Database query duration",
      labelNames: ["model", "operation"],
      registers: [registry],
    }),

    // Business
    settlementsFinalisedTotal: new Counter({
      name: "apgms_settlements_finalised_total",
      help: "Total BAS settlements finalised",
      registers: [registry],
    }),

    obligationsOutstandingCents: new Gauge({
      name: "apgms_obligations_outstanding_cents",
      help: "Outstanding obligations in cents",
      registers: [registry],
    }),

    // Risk
    riskBandGauge: new Gauge({
      name: "apgms_risk_band",
      help: "Current risk band",
      labelNames: ["band"],
      registers: [registry],
    }),
  };
}

export function getMetricsRegistry() {
  if (!registry) {
    registry = new Registry();
    collectDefaultMetrics({ register: registry });
    metrics = createMetrics(registry);
  }

  return registry;
}

export function getMetrics() {
  if (!metrics) {
    getMetricsRegistry();
  }
  return metrics!;
}
