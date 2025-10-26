import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register,
} from "prom-client";
import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyRequest,
} from "fastify";

collectDefaultMetrics();

// total request counter
const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of API gateway requests",
  labelNames: ["method", "route", "status"] as const,
});

// duration histogram
const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "Distribution of API gateway response times in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

// security / anomaly / audit counters
const securityEventsTotal = new Counter({
  name: "security_events_total",
  help: "Count of security-related events (auth failures, CORS rejects, etc.)",
  labelNames: ["event"] as const,
});

const authFailuresTotal = new Counter({
  name: "auth_failures_total",
  help: "AuthN/AuthZ failures by org (rate-limited, bad token, etc.)",
  labelNames: ["orgId"] as const,
});

const corsRejectTotal = new Counter({
  name: "cors_reject_total",
  help: "Number of browser CORS rejections by origin",
  labelNames: ["origin"] as const,
});

const metricsPlugin: FastifyPluginCallback = (app, _opts, done) => {
  // per-request timing hook
  app.addHook("onResponse", (request, reply, doneHook) => {
    const scopedRequest = request as FastifyRequest & {
      routerPath?: string;
      routeOptions?: { url?: string };
    };

    const route =
      scopedRequest.routerPath ??
      scopedRequest.routeOptions?.url ??
      request.url ??
      "unknown";

    const labels = {
      method: request.method,
      route,
      status: reply.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);

    // Fastify reply.getResponseTime() is only there if you have the timing plugin,
    // so we guard it.
    const getResponseTime = (reply as typeof reply & {
      getResponseTime?: () => number;
    }).getResponseTime;
    const responseTimeSeconds =
      typeof getResponseTime === "function"
        ? getResponseTime() / 1000
        : 0;

    if (responseTimeSeconds >= 0) {
      httpRequestDurationSeconds.observe(labels, responseTimeSeconds);
    }

    doneHook();
  });

  // /metrics endpoint for Prometheus
  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
  });

  // decorate app with helper methods we call elsewhere
  app.decorate("metrics", {
    recordSecurityEvent: (event: string) => {
      securityEventsTotal.inc({ event });
    },
    incAuthFailure: (orgId: string) => {
      authFailuresTotal.inc({ orgId });
    },
    incCorsReject: (origin: string) => {
      corsRejectTotal.inc({ origin });
    },
  });

  done();
};

export default metricsPlugin;
