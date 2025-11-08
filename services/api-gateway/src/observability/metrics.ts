import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register as promRegister,
} from "prom-client";

collectDefaultMetrics({ register: promRegister });

const httpRequestTotal = new Counter({
  name: "apgms_http_requests_total",
  help: "Total number of HTTP requests received by method, route, and status code",
  labelNames: ["method", "route", "status"] as const,
});

const httpRequestDuration = new Histogram({
  name: "apgms_http_request_duration_seconds",
  help: "HTTP request duration histogram",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

const dbQueryDuration = new Histogram({
  name: "apgms_db_query_duration_seconds",
  help: "Prisma query duration histogram by model and operation",
  labelNames: ["model", "operation"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

const dbQueryTotal = new Counter({
  name: "apgms_db_queries_total",
  help: "Total Prisma queries by model, operation, and status",
  labelNames: ["model", "operation", "status"] as const,
});

const jobDuration = new Histogram({
  name: "apgms_job_duration_seconds",
  help: "Background job duration histogram",
  labelNames: ["job"] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
});

const securityEventsTotal = new Counter({
  name: "apgms_security_events_total",
  help: "Count of security-related events (auth failures, anomalous routes, manual security logs)",
  labelNames: ["event"] as const,
});

const authFailuresTotal = new Counter({
  name: "apgms_auth_failures_total",
  help: "Authentication and authorization failures by organisation",
  labelNames: ["orgId"] as const,
});

const normaliseCorsOriginLabel = (origin: string): string => {
  if (!origin) {
    return "missing";
  }

  try {
    const { protocol } = new URL(origin);

    switch (protocol) {
      case "https:":
        return "valid_https";
      case "http:":
        return "valid_http";
      default:
        return "valid_other";
    }
  } catch {
    return "invalid";
  }
};

const corsRejectTotal = new Counter({
  name: "apgms_cors_reject_total",
  help: "Number of rejected CORS requests grouped by origin bucket",
  labelNames: ["origin"] as const,
});

export type AppSecurityMetrics = {
  recordSecurityEvent(event: string): void;
  incAuthFailure(orgId: string): void;
  incCorsReject(origin: string): void;
};

export const appSecurityMetrics: AppSecurityMetrics = {
  recordSecurityEvent(event: string) {
    securityEventsTotal.inc({ event });
  },
  incAuthFailure(orgId: string) {
    authFailuresTotal.inc({ orgId });
  },
  incCorsReject(origin: string) {
    corsRejectTotal.inc({ origin: normaliseCorsOriginLabel(origin) });
  },
};

export const metrics = {
  httpRequestTotal,
  httpRequestDuration,
  dbQueryDuration,
  dbQueryTotal,
  jobDuration,
  async observeJob<T>(job: string, fn: () => Promise<T>): Promise<T> {
    const stop = jobDuration.startTimer({ job });
    try {
      const result = await fn();
      stop();
      return result;
    } catch (error) {
      stop();
      throw error;
    }
  },
};

export { promRegister };

