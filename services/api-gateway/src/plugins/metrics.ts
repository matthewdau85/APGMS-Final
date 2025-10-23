import { Counter, collectDefaultMetrics, register } from "prom-client";
import type { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";

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
    const scopedRequest = request as FastifyRequest & {
      routerPath?: string;
      routeOptions?: { url?: string };
    };
    httpRequestsTotal.inc({
      method: request.method,
      route: scopedRequest.routerPath ?? scopedRequest.routeOptions?.url ?? request.url ?? "unknown",
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
