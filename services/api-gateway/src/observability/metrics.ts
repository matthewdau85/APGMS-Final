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
  labelNames: ["method", "route", "status"] as const,
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

const latestMonitoringSnapshotTimestamps = new Map<string, number>();

const monitoringSnapshotLagSeconds = new Gauge({
  name: "apgms_monitoring_snapshot_lag_seconds",
  help: "Age of the most recent monitoring snapshot in seconds",
  labelNames: ["org_id"] as const,
  collect(this: Gauge<string>) {
    const now = Date.now();
    for (const [orgId, timestamp] of latestMonitoringSnapshotTimestamps.entries()) {
      const lagSeconds = Math.max(0, (now - timestamp) / 1000);
      this.set({ org_id: orgId }, lagSeconds);
    }
  },
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
  recordMonitoringSnapshotLag(orgId: string, createdAt: Date | number): void {
    const timestamp = createdAt instanceof Date ? createdAt.getTime() : createdAt;
    latestMonitoringSnapshotTimestamps.set(orgId, timestamp);
    const lagSeconds = Math.max(0, (Date.now() - timestamp) / 1000);
    monitoringSnapshotLagSeconds.labels(orgId).set(lagSeconds);
  },
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

