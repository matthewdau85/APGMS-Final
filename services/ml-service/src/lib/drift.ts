import { Gauge } from "prom-client";
import type { ModelDefinition } from "./modelRegistry.js";
import { registry } from "./metrics.js";

export const driftGauge = new Gauge({
  name: "ml_feature_drift_score",
  help: "Normalized drift from baseline per feature",
  labelNames: ["model", "feature"] as const,
  registers: [registry]
});

export type DriftObservation = {
  feature: string;
  delta: number;
};

type AggregateState = {
  count: number;
  sums: Map<string, number>;
};

const aggregates = new Map<string, AggregateState>();

export function observeDrift(model: ModelDefinition, features: Record<string, number>): DriftObservation[] {
  let agg = aggregates.get(model.name);
  if (!agg) {
    agg = { count: 0, sums: new Map() };
    aggregates.set(model.name, agg);
  }

  agg.count += 1;
  const deltas: DriftObservation[] = [];

  for (const feature of model.features) {
    const value = Number(features[feature.key] ?? 0);
    const prev = agg.sums.get(feature.key) ?? 0;
    const nextSum = prev + value;
    agg.sums.set(feature.key, nextSum);
    const mean = nextSum / agg.count;
    const baseline = model.driftBaseline[feature.key] ?? 0;
    const delta = Number((mean - baseline).toFixed(4));
    driftGauge.labels({ model: model.name, feature: feature.key }).set(delta);
    deltas.push({ feature: feature.key, delta });
  }

  return deltas;
}
