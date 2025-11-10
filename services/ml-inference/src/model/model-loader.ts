import { readFile } from "node:fs/promises";

import type { FeatureVector, ModelFileSchema, SerializedModel } from "./types.js";

export interface LoadedModel {
  definition: SerializedModel;
  score(features: FeatureVector): number;
  isAnomalous(score: number): boolean;
}

export async function loadModel(modelPath: string): Promise<LoadedModel> {
  const raw = await readFile(modelPath, "utf8");
  const parsed = JSON.parse(raw) as ModelFileSchema;
  validateModel(parsed.model);

  return {
    definition: parsed.model,
    score: (features) => logisticScore(parsed.model, features),
    isAnomalous: (score) => score >= parsed.model.threshold,
  };
}

function logisticScore(model: SerializedModel, features: FeatureVector): number {
  const vector = model.features.map((name) => {
    const value = features[name];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`Missing or invalid feature: ${name}`);
    }
    return value;
  });

  const normalised = vector.map((value, idx) => {
    const std = model.scaler.std[idx] ?? 1;
    if (std === 0) {
      return value - (model.scaler.mean[idx] ?? 0);
    }
    return (value - (model.scaler.mean[idx] ?? 0)) / std;
  });

  const score = normalised.reduce((acc, value, idx) => acc + value * model.weights[idx], model.bias);
  return 1 / (1 + Math.exp(-score));
}

function validateModel(model: SerializedModel): void {
  if (model.features.length !== model.weights.length) {
    throw new Error("Feature and weight length mismatch");
  }
  if (model.scaler.mean.length !== model.features.length) {
    throw new Error("Scaler mean does not match feature length");
  }
  if (model.scaler.std.length !== model.features.length) {
    throw new Error("Scaler std does not match feature length");
  }
  if (model.threshold <= 0 || model.threshold >= 1) {
    throw new Error("Threshold must be in (0,1)");
  }
}
