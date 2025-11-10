import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { modelManifest } from '../config/modelManifest.js';
import { recordDriftSignals, recordInference, registerModelBudget, type DriftSignal } from '../observability/metrics.js';

const inferenceSchema = z.object({
  modelId: z.string(),
  modelVersion: z.string(),
  predictionId: z.string(),
  inputs: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  overrideOutcome: z.enum(['success', 'error']).optional(),
  errorType: z.string().optional(),
});

type InferencePayload = z.infer<typeof inferenceSchema>;

function computeScore(inputs: Record<string, unknown>): number {
  const amount = Number(inputs.transactionAmount ?? 0);
  const tenure = Number(inputs.merchantTenureMonths ?? 0);
  const amountStats = modelManifest.baselineFeatureStats.transactionAmount ?? { mean: 0, stdDev: 1 };
  const tenureStats = modelManifest.baselineFeatureStats.merchantTenureMonths ?? { mean: 0, stdDev: 1 };
  const normalizedAmount = (amount - amountStats.mean) / Math.max(amountStats.stdDev, 1);
  const normalizedTenure = (tenure - tenureStats.mean) / Math.max(tenureStats.stdDev, 1);
  const raw = 1 / (1 + Math.exp(-(0.8 * normalizedAmount - 0.4 * normalizedTenure)));
  return Number(raw.toFixed(4));
}

function calculateDrift(inputs: Record<string, unknown>): DriftSignal[] {
  return Object.entries(modelManifest.baselineFeatureStats).map(([feature, stats]) => {
    const value = Number(inputs[feature] ?? 0);
    if (!Number.isFinite(value) || stats.stdDev === 0) {
      return { feature, score: 0 };
    }
    const zScore = Math.abs(value - stats.mean) / stats.stdDev;
    const normalized = Math.min(zScore / 3, 1);
    return { feature, score: Number(normalized.toFixed(4)) };
  });
}

export const inferencePlugin: FastifyPluginAsync = async (app) => {
  registerModelBudget(modelManifest.modelId, modelManifest.version, modelManifest.slo.targetErrorRate);

  app.post('/inference', async (request, reply) => {
    const parsed = inferenceSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        message: 'Invalid inference payload',
        issues: parsed.error.flatten(),
      };
    }

    const payload: InferencePayload = parsed.data;
    if (payload.modelId !== modelManifest.modelId || payload.modelVersion !== modelManifest.version) {
      reply.status(409);
      return {
        message: 'Model version mismatch',
        expected: { id: modelManifest.modelId, version: modelManifest.version },
      };
    }

    const start = process.hrtime.bigint();
    let outcome: 'success' | 'error' = 'success';
    try {
      const driftSignals = calculateDrift(payload.inputs);
      recordDriftSignals(payload.modelId, payload.modelVersion, driftSignals);

      if (payload.overrideOutcome === 'error') {
        outcome = 'error';
        throw new Error(payload.errorType ?? 'manual_override');
      }

      const score = computeScore(payload.inputs);
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      recordInference(payload.modelId, payload.modelVersion, 'success', durationSeconds);

      return {
        predictionId: payload.predictionId,
        modelId: payload.modelId,
        modelVersion: payload.modelVersion,
        score,
        driftSignals,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      outcome = 'error';
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      recordInference(
        payload.modelId,
        payload.modelVersion,
        outcome,
        durationSeconds,
        payload.errorType ?? (error instanceof Error ? error.message : 'unknown_error'),
      );
      reply.status(502);
      return {
        message: 'Inference failed',
        predictionId: payload.predictionId,
        error: error instanceof Error ? error.message : 'unknown_error',
      };
    }
  });
};
