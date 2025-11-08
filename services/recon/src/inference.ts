import { SpanStatusCode, context, trace } from "@opentelemetry/api";

import type {
  DriftSignal,
  FeatureVector,
  InferenceComputation,
  ReconModel,
} from "./types.js";

const tracer = trace.getTracer("services.recon.inference");

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) {
    return 0;
  }
  return (value - mean) / stdDev;
}

function normalizeFeatures(model: ReconModel, features: FeatureVector): Record<string, number> {
  return model.features.reduce<Record<string, number>>((acc, feature) => {
    const value = features[feature.name] ?? 0;
    acc[feature.name] = zScore(value, feature.mean, feature.stdDev);
    return acc;
  }, {});
}

function computeLinearCombination(model: ReconModel, normalized: Record<string, number>): number {
  return model.features.reduce((acc, feature) => {
    const value = normalized[feature.name] ?? 0;
    return acc + feature.weight * value;
  }, model.bias);
}

function detectDrift(
  model: ReconModel,
  normalized: Record<string, number>,
): DriftSignal[] {
  const threshold = model.driftStdDeviations;
  return model.features
    .map((feature) => {
      const score = Math.abs(normalized[feature.name] ?? 0);
      return {
        feature: feature.name,
        score,
        threshold,
      } satisfies DriftSignal;
    })
    .filter((signal) => signal.score >= threshold);
}

export function runModelInference(
  model: ReconModel,
  features: FeatureVector,
): InferenceComputation {
  return context.with(trace.setSpan(context.active(), tracer.startSpan("inference")), (activeCtx) => {
    const normalized = normalizeFeatures(model, features);
    const linearScore = computeLinearCombination(model, normalized);
    const riskScore = Number(sigmoid(linearScore).toFixed(6));
    const confidence = Number((1 - Math.exp(-Math.abs(linearScore))).toFixed(6));
    const decision = riskScore >= model.decisionThreshold ? "REVIEW" : "CLEAR";
    const fallbackRecommended = confidence < model.confidenceThreshold;
    const driftSignals = detectDrift(model, normalized);

    const span = trace.getSpan(activeCtx);
    if (span) {
      span.setAttribute("recon.model.version", model.version);
      span.setAttribute("recon.model.decisionThreshold", model.decisionThreshold);
      span.setAttribute("recon.inference.riskScore", riskScore);
      span.setAttribute("recon.inference.confidence", confidence);
      span.setAttribute("recon.inference.decision", decision);
      span.setAttribute("recon.inference.driftCount", driftSignals.length);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }

    return {
      riskScore,
      confidence,
      decision,
      fallbackRecommended,
      driftSignals,
    } satisfies InferenceComputation;
  });
}
