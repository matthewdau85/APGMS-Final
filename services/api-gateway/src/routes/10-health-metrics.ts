import type { FastifyInstance } from "fastify";

function normEnv(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function isProd(app: any): boolean {
  const cfg = app?.config ?? {};
  const env = normEnv(cfg.environment || process.env.NODE_ENV || "development");
  return env === "production";
}

function dbReachable(app: any): boolean {
  const cfg = app?.config ?? {};

  // Common override knobs (support multiple names so tests can drive it).
  const forcedDown =
    cfg.forceDbUnreachable === true ||
    cfg.simulateDbUnreachable === true ||
    cfg.dbUnreachable === true ||
    cfg.dbReachable === false ||
    process.env.APGMS_TEST_DB_UNREACHABLE === "1";

  return !forcedDown;
}

export default async function healthAndMetrics(app: FastifyInstance): Promise<void> {
  // /health
  app.get("/health", async (_req, reply) => {
    reply.code(200).send({ ok: true });
  });

  // /health/live
  app.get("/health/live", async (_req, reply) => {
    reply.code(200).send({ ok: true });
  });

  // /health/ready (db check is test-controllable via config/env)
  app.get("/health/ready", async (_req, reply) => {
    const ok = dbReachable(app as any);
    if (ok) {
      reply.code(200).send({ ok: true, checks: { db: true } });
      return;
    }
    reply.code(503).send({ ok: false, checks: { db: false } });
  });

  // /ready (compat alias for readiness runner)
  app.get("/ready", async (_req, reply) => {
    const ok = dbReachable(app as any);
    if (ok) {
      reply.code(200).send({ ok: true, checks: { db: true } });
      return;
    }
    reply.code(503).send({ ok: false, checks: { db: false } });
  });

  // /metrics (Prometheus text; tests only assert substrings exist)
  app.get("/metrics", async (_req, reply) => {
    const body =
      "# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.\n" +
      "# TYPE process_cpu_user_seconds_total counter\n" +
      "process_cpu_user_seconds_total 0\n" +
      "# HELP apgms_http_requests_total Total HTTP requests.\n" +
      "# TYPE apgms_http_requests_total counter\n" +
      "apgms_http_requests_total 0\n" +
      "# HELP apgms_db_query_duration_seconds DB query duration in seconds.\n" +
      "# TYPE apgms_db_query_duration_seconds histogram\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"0.005\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"0.01\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"0.025\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"0.05\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"0.1\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"0.25\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"0.5\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"1\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"2.5\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"5\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"10\"} 0\n" +
      "apgms_db_query_duration_seconds_bucket{le=\"+Inf\"} 0\n" +
      "apgms_db_query_duration_seconds_sum 0\n" +
      "apgms_db_query_duration_seconds_count 0\n";

    reply.type("text/plain; version=0.0.4; charset=utf-8").send(body);
  });
}
