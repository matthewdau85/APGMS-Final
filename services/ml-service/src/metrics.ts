import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

type DriftScores = Record<string, number>;

type InferenceObservation = {
  modelVersion: string;
  durationMs: number;
  outcome: "success" | "error";
  errorBudgetRemaining?: number;
  driftScores?: DriftScores;
};

type FeedbackObservation = {
  role: "finance" | "regulator";
  label: string;
};

export const registry = new Registry();
registry.setDefaultLabels({ service: "ml-service" });

collectDefaultMetrics({ register: registry });

export const inferenceLatency = new Histogram({
  name: "ml_inference_duration_seconds",
  help: "Observed inference latency by model version and outcome.",
  labelNames: ["model_version", "outcome"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

export const errorBudgetGauge = new Gauge({
  name: "ml_inference_error_budget_remaining",
  help: "Remaining error budget (0-1) for a given model version.",
  labelNames: ["model_version"],
  registers: [registry],
});

export const driftGauge = new Gauge({
  name: "ml_feature_drift_score",
  help: "Population drift score (0-1) by model version and feature.",
  labelNames: ["model_version", "feature"],
  registers: [registry],
});

export const feedbackCounter = new Counter({
  name: "ml_feedback_labels_total",
  help: "Count of human feedback labels grouped by submitting role and label.",
  labelNames: ["submitted_role", "label"],
  registers: [registry],
});

export function observeInference({
  modelVersion,
  durationMs,
  outcome,
  errorBudgetRemaining,
  driftScores,
}: InferenceObservation) {
  inferenceLatency.observe({ model_version: modelVersion, outcome }, durationMs / 1000);

  if (typeof errorBudgetRemaining === "number") {
    errorBudgetGauge.set({ model_version: modelVersion }, errorBudgetRemaining);
  }

  if (driftScores) {
    for (const [feature, score] of Object.entries(driftScores)) {
      driftGauge.set({ model_version: modelVersion, feature }, score);
    }
  }
}

export function recordFeedbackMetric({ role, label }: FeedbackObservation) {
  feedbackCounter.inc({ submitted_role: role, label });
}
