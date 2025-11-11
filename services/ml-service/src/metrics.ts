import { collectDefaultMetrics, Histogram, Registry, Gauge } from "prom-client";

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const inferenceDuration = new Histogram({
  name: "ml_inference_duration_seconds",
  help: "Latency of model scoring operations",
  labelNames: ["model", "scenario"],
  registers: [registry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const featureDrift = new Gauge({
  name: "ml_feature_drift_score",
  help: "Rolling z-score magnitude per feature",
  labelNames: ["model", "feature"],
  registers: [registry],
});

export function recordFeatureDrift(
  modelId: string,
  deltas: Record<string, number>,
): void {
  for (const [feature, value] of Object.entries(deltas)) {
    featureDrift.labels(modelId, feature).set(value);
  }
}
