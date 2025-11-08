import {
  Counter,
  Gauge,
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

const httpRequestErrorsTotal = new Counter({
  name: "apgms_http_request_errors_total",
  help: "Total number of HTTP requests that returned a 5xx status code",
  labelNames: ["route"] as const,
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

const queueBacklogDepth = new Gauge({
  name: "apgms_queue_backlog_depth",
  help: "Synthetic queue backlog depth by queue name",
  labelNames: ["queue"] as const,
});

const monitoringSnapshotLagSeconds = new Gauge({
  name: "apgms_monitoring_snapshot_lag_seconds",
  help: "Age of the most recent monitoring snapshot in seconds",
  labelNames: ["org_id"] as const,
});

export const metrics = {
  httpRequestTotal,
  httpRequestDuration,
  httpRequestErrorsTotal,
  dbQueryDuration,
  dbQueryTotal,
  jobDuration,
  queueBacklogDepth,
  monitoringSnapshotLagSeconds,
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

