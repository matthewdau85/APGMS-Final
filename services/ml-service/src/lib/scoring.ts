import type { ModelDefinition } from "./modelRegistry.js";

export type ScoreResult = {
  score: number;
  contributions: Array<{
    feature: string;
    value: number;
    weight: number;
    contribution: number;
  }>;
};

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function scoreModel(model: ModelDefinition, features: Record<string, number>): ScoreResult {
  let linear = model.bias;
  const contributions: ScoreResult["contributions"] = [];
  for (const feature of model.features) {
    const value = Number(features[feature.key] ?? 0);
    const contribution = value * feature.weight;
    linear += contribution;
    contributions.push({
      feature: feature.key,
      value,
      weight: feature.weight,
      contribution
    });
  }

  const score = Number(sigmoid(linear).toFixed(4));
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return { score, contributions };
}

export function buildExplanations(
  model: ModelDefinition,
  observed: Record<string, number>
): Array<{ feature: string; direction: "increase" | "decrease"; summary: string }> {
  return model.features.map((feature) => {
    const value = Number(observed[feature.key] ?? 0);
    const baseline = model.driftBaseline[feature.key] ?? 0;
    const direction = value >= baseline ? "increase" : "decrease";
    const explanation = model.explanations[feature.key];
    const summary = direction === "increase" ? explanation.high : explanation.low;
    return { feature: feature.key, direction, summary };
  });
}
