// services/api-gateway/src/routes/metrics.ts
import type { FastifyPluginAsync } from "fastify";
import client from "prom-client";

type Environment = "development" | "test" | "production";
export type MetricsPluginOpts = { environment?: Environment };

// Dedicated registry for the API gateway
export const metricsRegistry = new client.Registry();

// Ensure we only register collectors once per process (Jest creates many apps)
let defaultMetricsStarted = false;
let httpMetricsStarted = false;

let httpRequestsTotal: client.Counter<string> | null = null;
let httpDurationSeconds: client.Histogram<string> | null = null;

function ensureMetrics() {
  if (!defaultMetricsStarted) {
    defaultMetricsStarted = true;
    client.collectDefaultMetrics({ register: metricsRegistry });
  }

  if (!httpMetricsStarted) {
    httpMetricsStarted = true;

    httpRequestsTotal = new client.Counter({
      name: "apgms_http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status_code"] as const,
      registers: [metricsRegistry],
    });

    httpDurationSeconds = new client.Histogram({
      name: "apgms_http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [metricsRegistry],
    });
  }
}

function routeLabel(req: any): string {
  return (
    (req?.routeOptions && req.routeOptions.url) ||
    req?.routerPath ||
    // last resort (includes querystring; not ideal, but only used when we have no route match)
    String(req?.url || "unknown")
  );
}

export const metricsPlugin: FastifyPluginAsync<MetricsPluginOpts> = async (app, opts) => {
  ensureMetrics();

  // Start timer early
  app.addHook("onRequest", async (req) => {
    (req as any).__metricsStart = process.hrtime.bigint();
  });

  // Observe metrics on response
  app.addHook("onResponse", async (req, reply) => {
    const start = (req as any).__metricsStart as bigint | undefined;
    const method = String(req.method || "UNKNOWN");
    const route = routeLabel(req);
    const status = String(reply.statusCode ?? 0);

    if (httpRequestsTotal) {
      httpRequestsTotal.labels(method, route, status).inc(1);
    }

    if (start && httpDurationSeconds) {
      const end = process.hrtime.bigint();
      const seconds = Number(end - start) / 1e9;
      httpDurationSeconds.labels(method, route, status).observe(seconds);
    }
  });

  // Optional: protect /metrics in production if token is set
  const bearer = process.env.METRICS_BEARER_TOKEN;
  const isProd = opts.environment === "production";

  app.get("/metrics", async (req, reply) => {
    if (isProd && bearer) {
      const auth = String(req.headers.authorization ?? "");
      if (auth !== `Bearer ${bearer}`) {
        return reply.code(401).send({ error: "metrics_unauthorized" });
      }
    }

    reply.header("content-type", metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });
};

export default metricsPlugin;
