import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { LinearModelDefinition } from "./types.js";

export interface ModelRepository {
  readonly shortfall: LinearModelDefinition;
  readonly fraud: LinearModelDefinition;
  readonly compliancePlan: LinearModelDefinition;
}

export async function loadModels(rootDir: string): Promise<ModelRepository> {
  const [shortfallRaw, fraudRaw, complianceRaw] = await Promise.all([
    readModel(rootDir, "shortfall.json"),
    readModel(rootDir, "fraud.json"),
    readModel(rootDir, "compliance-plan.json"),
  ]);

  return {
    shortfall: shortfallRaw,
    fraud: fraudRaw,
    compliancePlan: complianceRaw,
  };
}

async function readModel(rootDir: string, fileName: string): Promise<LinearModelDefinition> {
  const filePath = resolve(rootDir, fileName);
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as LinearModelDefinition;
  return parsed;
}

export function evaluateLinearModel(
  model: LinearModelDefinition,
  features: Record<string, number>,
): { score: number; confidenceInterval: [number, number]; recommendedActions: string[] } {
  const weightedSum = Object.entries(features).reduce(
    (sum, [name, value]) => sum + (model.weights[name] ?? 0) * value,
    model.intercept,
  );

  const score = sigmoid(weightedSum);
  const margin = Math.max(0, model.confidence.margin);
  const lower = clamp(score - margin, 0, 1);
  const upper = clamp(score + margin, 0, 1);

  const recommendation = [...model.recommendations]
    .sort((a, b) => b.threshold - a.threshold)
    .find((entry) => score >= entry.threshold);
  const recommended = recommendation ? [...recommendation.actions] : [];

  return {
    score,
    confidenceInterval: [lower, upper],
    recommendedActions: recommended,
  };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
