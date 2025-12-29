import type { FastifyInstance } from "fastify";
import * as promClient from "prom-client";
import { metrics } from "../observability/metrics.js";

function ensureDbQueryMetric() {
  const reg: any = (metrics as any)?.registry ?? promClient.register;
  const existing =
    typeof reg?.getSingleMetric === "function"
      ? reg.getSingleMetric("apgms_db_query_duration_seconds")
      : promClient.register.getSingleMetric("apgms_db_query_duration_seconds");

  if (existing) return;

  const opts: any = {
    name: "apgms_db_query_duration_seconds",
    help: "DB query duration in seconds",
    labelNames: ["model", "op"],
  };

  // If metrics uses a custom registry, register there explicitly.
  if (reg && reg !== promClient.register) {
    opts.registers = [reg];
  }

  // eslint-disable-next-line no-new
  new promClient.Histogram(opts);
}

export default async function registerMetricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async (_req, reply) => {
    ensureDbQueryMetric();

    const reg: any = (metrics as any)?.registry ?? promClient.register;
    const body = typeof reg?.metrics === "function" ? await reg.metrics() : await promClient.register.metrics();

    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return body;
  });
}
