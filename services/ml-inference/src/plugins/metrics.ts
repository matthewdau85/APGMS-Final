import type { FastifyInstance } from "fastify";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

export const inferenceDuration = new Histogram({
  name: "apgms_ml_inference_duration_seconds",
  help: "Time spent performing anomaly inference",
  labelNames: ["outcome"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

export const inferenceCounter = new Counter({
  name: "apgms_ml_inference_total",
  help: "Number of inference requests processed",
  labelNames: ["outcome"],
});

export const anomalyGauge = new Gauge({
  name: "apgms_ml_active_anomalies",
  help: "Current number of anomalies detected in the last window",
});

export async function registerMetrics(app: FastifyInstance): Promise<void> {
  const registry = new Registry();
  registry.registerMetric(inferenceDuration);
  registry.registerMetric(inferenceCounter);
  registry.registerMetric(anomalyGauge);
  collectDefaultMetrics({ register: registry });

  app.get("/metrics", async () => {
    return registry.metrics();
  });

  app.decorate("metrics", registry);
}

declare module "fastify" {
  interface FastifyInstance {
    metrics: Registry;
  }
}
