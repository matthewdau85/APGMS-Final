import { inferenceDuration, recordFeatureDrift } from "./metrics.js";
import type { LoadedModel } from "./model-loader.js";

export interface ScoreInput {
  readonly scenario: string;
  readonly model: LoadedModel;
  readonly features: Record<string, number>;
}

export interface ScoreResult {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly score: number;
  readonly threshold: number;
  readonly passed: boolean;
  readonly contributions: Array<{
    feature: string;
    value: number;
    weight: number;
    impact: number;
    explanation?: string;
  }>;
  readonly drift: Record<string, number>;
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export function evaluateScore({
  scenario,
  model,
  features,
}: ScoreInput): ScoreResult {
  const timer = inferenceDuration.startTimer({ model: model.id, scenario });
  try {
    let weightedSum = model.bias;
    const contributions: ScoreResult["contributions"] = [];

    for (const [feature, weight] of Object.entries(model.coefficients)) {
      const value = features[feature] ?? 0;
      const impact = value * weight;
      weightedSum += impact;
      contributions.push({
        feature,
        value,
        weight,
        impact,
        explanation: model.explanations?.[feature],
      });
    }

    const score = logistic(weightedSum);
    const threshold = model.threshold;
    const passed = score < threshold;

    const driftScores: Record<string, number> = {};
    for (const [feature, stats] of Object.entries(model.featureStats)) {
      const value = features[feature] ?? 0;
      if (!Number.isFinite(stats.std) || stats.std <= 0) {
        driftScores[feature] = 0;
        continue;
      }
      const zScore = Math.abs((value - stats.mean) / stats.std);
      driftScores[feature] = Number(zScore.toFixed(3));
    }

    recordFeatureDrift(model.id, driftScores);

    contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return {
      modelId: model.id,
      modelVersion: model.version,
      score: Number(score.toFixed(4)),
      threshold,
      passed,
      contributions,
      drift: driftScores,
    };
  } finally {
    timer();
  }
}
