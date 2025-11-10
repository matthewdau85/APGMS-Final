import { Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const inferenceDuration = new Histogram({
  name: "ml_inference_duration_seconds",
  help: "Latency for ML inferences",
  labelNames: ["model"],
  registers: [registry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]
});
