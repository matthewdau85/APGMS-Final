import { Counter, Histogram, collectDefaultMetrics, register } from "prom-client";
import type { FastifyInstance } from "fastify";

collectDefaultMetrics({ register });

export const inferenceDuration = new Histogram({
  name: "apgms_inference_duration_seconds",
  help: "Inference execution duration",
  labelNames: ["transport", "modelVersion", "outcome"] as const,
});

export const inferenceRequests = new Counter({
  name: "apgms_inference_requests_total",
  help: "Total inference requests processed",
  labelNames: ["transport", "modelVersion", "outcome"] as const,
});

export const inferenceErrors = new Counter({
  name: "apgms_inference_errors_total",
  help: "Inference processing failures",
  labelNames: ["transport", "modelVersion", "reason"] as const,
});

export function registerMetricsRoute(app: FastifyInstance): void {
  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType);
    reply.send(await register.metrics());
  });
}

export function observeInference(
  transport: "http" | "nats",
  modelVersion: string,
  outcome: "success" | "error",
  durationSeconds: number,
): void {
  inferenceDuration.labels(transport, modelVersion, outcome).observe(durationSeconds);
  inferenceRequests.labels(transport, modelVersion, outcome).inc();
}

export function recordInferenceError(
  transport: "http" | "nats",
  modelVersion: string,
  reason: string,
): void {
  inferenceErrors.labels(transport, modelVersion, reason).inc();
}
