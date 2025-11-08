import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: "apgms_recon_" });

export const inferenceLatency = new Histogram({
  name: "apgms_recon_inference_latency_seconds",
  help: "Time spent performing reconciliation inference",
  registers: [registry],
  labelNames: ["transport", "decision"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const inferenceRequests = new Counter({
  name: "apgms_recon_inference_requests_total",
  help: "Total number of inference requests",
  registers: [registry],
  labelNames: ["transport"],
});

export const inferenceErrors = new Counter({
  name: "apgms_recon_inference_errors_total",
  help: "Total number of inference failures",
  registers: [registry],
  labelNames: ["transport", "reason"],
});

export const fallbackCounter = new Counter({
  name: "apgms_recon_fallback_total",
  help: "Number of times deterministic fallback was recommended",
  registers: [registry],
});

export const conceptDriftGauge = new Gauge({
  name: "apgms_recon_concept_drift_active",
  help: "Indicates whether concept drift signals were detected",
  registers: [registry],
  labelNames: ["feature"],
});

export const conceptDriftTotal = new Counter({
  name: "apgms_recon_concept_drift_total",
  help: "Count of inference requests that triggered concept drift",
  registers: [registry],
});
