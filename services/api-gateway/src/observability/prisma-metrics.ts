import { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from "prom-client";

let registry: Registry | null = null;
let metrics: ReturnType<typeof createMetrics> | null = null;

export function getMetricsRegistry() {
  if (!registry) {
    registry = new Registry();
    collectDefaultMetrics({ register: registry });
  }
  return registry;
}

function createMetrics() {
  const register = getMetricsRegistry();

  return {
    // HTTP
    httpRequestTotal: new Counter({
      name: "apgms_http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [register],
    }),

    httpRequestDuration: new Histogram({
      name: "apgms_http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"],
      registers: [register],
    }),

    // DB
    dbQueryDurationSeconds: new Histogram({
      name: "apgms_db_query_duration_seconds",
      help: "Database query duration in seconds",
      labelNames: ["model", "operation"],
      registers: [register],
    }),

    // Business
    settlementsFinalisedTotal: new Counter({
      name: "apgms_settlements_finalised_total",
      help: "Total BAS settlements finalised",
      registers: [register],
    }),

    obligationsOutstandingCents: new Gauge({
      name: "apgms_obligations_outstanding_cents",
      help: "Outstanding obligations in cents",
      registers: [register],
    }),
  };
}

export function getMetrics() {
  if (!metrics) {
    metrics = createMetrics();
  }
  return metrics;
}
