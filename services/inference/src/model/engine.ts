import modelSpec from "./model.json" with { type: "json" };

import type {
  InferenceFeatureVector,
  InferenceResult,
  RiskBand,
} from "@apgms/shared";

export interface ModelSpecification {
  version: string;
  bias: number;
  coefficients: Record<keyof InferenceFeatureVector, number>;
  thresholds: {
    medium: number;
    high: number;
  };
}

export class InferenceEngine {
  private readonly spec: ModelSpecification;

  public constructor(spec: ModelSpecification = modelSpec as ModelSpecification) {
    this.spec = spec;
  }

  public get version(): string {
    return this.spec.version;
  }

  public score(
    features: InferenceFeatureVector,
  ): Omit<InferenceResult, "requestId"> {
    const logits = this.computeLogits(features);
    const probability = sigmoid(logits);
    const band = this.classify(probability);

    return {
      modelVersion: this.spec.version,
      score: Number(probability.toFixed(6)),
      riskBand: band,
      contributingFeatures: this.identifyDrivers(features, probability),
    };
  }

  private computeLogits(features: InferenceFeatureVector): number {
    const entries = Object.entries(this.spec.coefficients) as Array<[
      keyof InferenceFeatureVector,
      number,
    ]>;
    return entries.reduce((acc, [name, weight]) => acc + (features[name] ?? 0) * weight, this.spec.bias);
  }

  private classify(probability: number): RiskBand {
    if (probability >= this.spec.thresholds.high) {
      return "high";
    }
    if (probability >= this.spec.thresholds.medium) {
      return "medium";
    }
    return "low";
  }

  private identifyDrivers(
    features: InferenceFeatureVector,
    probability: number,
  ): Array<{ feature: keyof InferenceFeatureVector; contribution: number }> {
    const contributions: Array<{ feature: keyof InferenceFeatureVector; contribution: number }> = [];
    for (const [name, weight] of Object.entries(this.spec.coefficients) as Array<[
      keyof InferenceFeatureVector,
      number,
    ]>) {
      const contribution = Number(((features[name] ?? 0) * weight).toFixed(4));
      contributions.push({ feature: name, contribution });
    }

    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const scale = probability <= 0 || probability >= 1 ? 1 : probability * (1 - probability);
    return contributions.map((entry) => ({
      feature: entry.feature,
      contribution: Number((entry.contribution * scale).toFixed(4)),
    }));
  }
}

function sigmoid(value: number): number {
  if (value > 30) return 1;
  if (value < -30) return 0;
  return 1 / (1 + Math.exp(-value));
}

export const defaultEngine = new InferenceEngine();
