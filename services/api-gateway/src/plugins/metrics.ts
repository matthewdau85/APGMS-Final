import { Counter, Histogram, collectDefaultMetrics, register } from "prom-client";
import type { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";

collectDefaultMetrics();

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of API gateway requests",
  labelNames: ["method", "route", "status"],
});

const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "Distribution of API gateway response times in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const securityEventsTotal = new Counter({
  name: "security_events_total",
  help: "Count of security-related events",
  labelNames: ["event"],
});

const metricsPlugin: FastifyPluginCallback = (app, _opts, done) => {
  app.addHook("onResponse", (request, reply, doneHook) => {
    const scopedRequest = request as FastifyRequest & {
      routerPath?: string;
      routeOptions?: { url?: string };
    };
    const route =
      scopedRequest.routerPath ?? scopedRequest.routeOptions?.url ?? request.url ?? "unknown";
    const labels = {
      method: request.method,
      route,
      status: reply.statusCode,
    };
    httpRequestsTotal.inc(labels);
    const getResponseTime = (reply as typeof reply & { getResponseTime?: () => number })
      .getResponseTime;
    const responseTimeSeconds = typeof getResponseTime === "function" ? getResponseTime() / 1000 : 0;
    if (responseTimeSeconds >= 0) {
      httpRequestDurationSeconds.observe(labels, responseTimeSeconds);
    }
    doneHook();
  });

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
  });

  app.decorate("metrics", {
    recordSecurityEvent: (event: string) => {
      securityEventsTotal.inc({ event });
    },
  });

  done();
};

export default metricsPlugin;
export type MetricsPlugin = {
  metrics: {
    recordSecurityEvent: (event: string) => void;
  };
};


declare module "fastify" {
  interface FastifyInstance {
    metrics: {
      recordSecurityEvent: (event: string) => void;
    };
  }
}
