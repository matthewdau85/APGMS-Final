import { Counter, Histogram, Registry, collectDefaultMetrics } from "./vendor/prom-client";

export interface Metrics {
  register: Registry;
  httpRequestsTotal: Counter;
  httpRequestDurationSeconds: Histogram;
}

export function createMetrics(): Metrics {
  const register = new Registry();
  collectDefaultMetrics();

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

  return { register, httpRequestsTotal, httpRequestDurationSeconds };
}
