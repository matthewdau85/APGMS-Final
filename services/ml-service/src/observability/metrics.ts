import type { FastifyPluginAsync } from 'fastify';
import {
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
  register as promRegister,
} from 'prom-client';

collectDefaultMetrics({ register: promRegister });

const inferenceRequests = new Counter({
  name: 'apgms_ml_inference_requests_total',
  help: 'Total inference requests grouped by model, version, and outcome',
  labelNames: ['model', 'version', 'outcome'] as const,
});

const inferenceLatency = new Histogram({
  name: 'apgms_ml_inference_duration_seconds',
  help: 'Inference latency histogram in seconds',
  labelNames: ['model', 'version', 'outcome'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

const inferenceErrorBudgetRemaining = new Gauge({
  name: 'apgms_ml_error_budget_remaining_ratio',
  help: 'Remaining error budget ratio (1 = budget intact, 0 = exhausted)',
  labelNames: ['model', 'version'] as const,
});

const inferenceErrorBudgetBurn = new Gauge({
  name: 'apgms_ml_error_budget_burn_rate',
  help: 'Burn rate of the error budget relative to SLO target',
  labelNames: ['model', 'version'] as const,
});

const inferenceErrors = new Counter({
  name: 'apgms_ml_inference_errors_total',
  help: 'Inference errors grouped by model, version, and error type',
  labelNames: ['model', 'version', 'error_type'] as const,
});

const driftGauge = new Gauge({
  name: 'apgms_ml_feature_drift_score',
  help: 'Data drift indicator (0=no drift, 1=severe) by model and feature',
  labelNames: ['model', 'version', 'feature'] as const,
});

const feedbackCounter = new Counter({
  name: 'apgms_ml_feedback_labels_total',
  help: 'Feedback labels captured by model, version, label, and source',
  labelNames: ['model', 'version', 'label', 'source'] as const,
});

const errorBudgetState = new Map<string, { total: number; errors: number }>();
const errorBudgetTargets = new Map<string, number>();
const DEFAULT_ERROR_BUDGET_TARGET = Number(process.env.ML_ERROR_BUDGET_TARGET ?? 0.02);

function key(model: string, version: string) {
  return `${model}::${version}`;
}

function updateErrorBudget(model: string, version: string) {
  const budgetKey = key(model, version);
  const target = errorBudgetTargets.get(budgetKey) ?? DEFAULT_ERROR_BUDGET_TARGET;
  const state = errorBudgetState.get(budgetKey) ?? { total: 0, errors: 0 };

  if (state.total === 0 || target <= 0) {
    inferenceErrorBudgetRemaining.set({ model, version }, 1);
    inferenceErrorBudgetBurn.set({ model, version }, 0);
    return;
  }

  const errorRate = state.errors / state.total;
  const burnRate = target > 0 ? errorRate / target : 0;
  const remaining = Math.max(0, 1 - burnRate);

  inferenceErrorBudgetRemaining.set({ model, version }, remaining);
  inferenceErrorBudgetBurn.set({ model, version }, burnRate);
}

export function registerModelBudget(model: string, version: string, target?: number) {
  const budgetKey = key(model, version);
  if (typeof target === 'number' && target > 0) {
    errorBudgetTargets.set(budgetKey, target);
  } else if (!errorBudgetTargets.has(budgetKey)) {
    errorBudgetTargets.set(budgetKey, DEFAULT_ERROR_BUDGET_TARGET);
  }
  if (!errorBudgetState.has(budgetKey)) {
    errorBudgetState.set(budgetKey, { total: 0, errors: 0 });
  }
  updateErrorBudget(model, version);
}

export function recordInference(model: string, version: string, outcome: 'success' | 'error', durationSeconds: number, errorType = 'none') {
  inferenceRequests.inc({ model, version, outcome }, 1);
  inferenceLatency.observe({ model, version, outcome }, durationSeconds);

  const budgetKey = key(model, version);
  const state = errorBudgetState.get(budgetKey) ?? { total: 0, errors: 0 };
  state.total += 1;
  if (outcome === 'error') {
    state.errors += 1;
    inferenceErrors.inc({ model, version, error_type: errorType }, 1);
  }
  errorBudgetState.set(budgetKey, state);
  updateErrorBudget(model, version);
}

export interface DriftSignal {
  feature: string;
  score: number;
}

export function recordDriftSignals(model: string, version: string, signals: DriftSignal[]) {
  for (const signal of signals) {
    const clamped = Math.max(0, Math.min(1, signal.score));
    driftGauge.set({ model, version, feature: signal.feature }, clamped);
  }
}

export function recordFeedbackMetric(
  model: string,
  version: string,
  label: string,
  source: string,
) {
  feedbackCounter.inc({ model, version, label, source }, 1);
}

export { promRegister };

export const metricsPlugin: FastifyPluginAsync = async (app) => {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', promRegister.contentType);
    return promRegister.metrics();
  });
};
