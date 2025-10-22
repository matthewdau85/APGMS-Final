import { Counter, collectDefaultMetrics, register } from "prom-client";
import type { FastifyInstance, FastifyPluginCallback } from "fastify";

collectDefaultMetrics();

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of API gateway requests",
  labelNames: ["method", "route", "status"],
});

const securityEventsTotal = new Counter({
  name: "security_events_total",
  help: "Count of security-related events",
  labelNames: ["event"],
});

const metricsPlugin: FastifyPluginCallback = (app, _opts, done) => {
  app.addHook("onResponse", (request, reply, doneHook) => {
    httpRequestsTotal.inc({
      method: request.method,
      route: request.routerPath ?? "unknown",
      status: reply.statusCode,
    });
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
