import type { FastifyInstance, FastifyRequest } from "fastify";
import { collectDefaultMetrics, Histogram, Registry } from "prom-client";

import type { PrismaLike } from "../app";

export interface MetricsContext {
  registry: Registry;
}

const PRISMA_METRICS_FLAG = Symbol.for("apgms.metrics.prisma");

function routeLabel(request: FastifyRequest): string {
  const route = (request.routeOptions && request.routeOptions.url) || (request as any).routerPath;
  return typeof route === "string" ? route : request.url;
}

export function setupMetrics(app: FastifyInstance, prisma: PrismaLike): MetricsContext {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "apgms_" });

  const httpHistogram = new Histogram({
    name: "apgms_http_request_duration_seconds",
    help: "Duration of HTTP requests handled by the API gateway.",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const dbHistogram = new Histogram({
    name: "apgms_db_query_duration_seconds",
    help: "Duration of Prisma database queries in seconds.",
    labelNames: ["model", "action"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [registry],
  });

  app.addHook("onRequest", (request, _reply, done) => {
    (request as any).__metricsStart = process.hrtime.bigint();
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const start = (request as any).__metricsStart as bigint | undefined;
    if (typeof start === "bigint") {
      const diff = process.hrtime.bigint() - start;
      const seconds = Number(diff) / 1e9;
      httpHistogram.observe(
        {
          method: request.method,
          route: routeLabel(request),
          status_code: reply.statusCode,
        },
        seconds
      );
    }
    done();
  });

  const prismaAny = prisma as PrismaLike & { [PRISMA_METRICS_FLAG]?: boolean };
  if (!prismaAny[PRISMA_METRICS_FLAG] && typeof prisma.$use === "function") {
    prismaAny[PRISMA_METRICS_FLAG] = true;
    prisma.$use?.(async (params, next) => {
      const model = params.model ?? "raw";
      const action = params.action ?? params.clientMethod ?? "query";
      const stopTimer = dbHistogram.startTimer({ model, action });
      try {
        return await next(params);
      } finally {
        stopTimer();
      }
    });
  }

  return { registry };
}
