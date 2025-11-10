import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

import { config } from "../config.js";
import { observeInference, recordInferenceError } from "../observability/metrics.js";
import type {
  BusEnvelope,
  InferenceCompletedEvent,
  InferenceRequestedEvent,
} from "@apgms/shared";
import { NatsBus, inferenceSubjects, safeLogAttributes, safeLogError } from "@apgms/shared";
import { validateFeatures } from "../validation.js";

export async function initInferenceWorker(app: FastifyInstance): Promise<void> {
  const natsConfig = config.nats;
  if (!natsConfig) return;

  const bus = await NatsBus.connect({
    url: natsConfig.url,
    stream: natsConfig.stream,
    subjectPrefix: natsConfig.subjectPrefix,
  });
  app.decorate("inferenceNats", bus);

  const subjects = inferenceSubjects(natsConfig.subjectPrefix);
  const unsubscribe = await bus.subscribe(subjects.request, natsConfig.durableName, async (message) => {
    const start = process.hrtime.bigint();
    const payload = message.payload as InferenceRequestedEvent;

    try {
      validateRequestEnvelope(payload);
    } catch (error) {
      const duration = calculateDurationSeconds(start);
      recordInferenceError("nats", app.inferenceEngine.version, "invalid_payload");
      observeInference("nats", app.inferenceEngine.version, "error", duration);
      app.log.warn(
        safeLogAttributes({
          event: "inference_nats_invalid_payload",
          requestId: payload.requestId,
          reason: error instanceof Error ? error.message : "invalid_payload",
        }),
      );
      return;
    }

    try {
      const scored = app.inferenceEngine.score(payload.features);
      const duration = calculateDurationSeconds(start);
      observeInference("nats", app.inferenceEngine.version, "success", duration);

      const resultEvent: InferenceCompletedEvent = {
        ...scored,
        requestId: payload.requestId,
        orgId: payload.orgId,
        processedAt: new Date().toISOString(),
        thresholdBreached: scored.score >= config.threshold,
        traceId: payload.traceId,
      };

      const envelope: BusEnvelope<InferenceCompletedEvent> = {
        id: randomUUID(),
        orgId: payload.orgId,
        eventType: "inference.completed",
        key: payload.requestId,
        ts: resultEvent.processedAt,
        schemaVersion: scored.modelVersion,
        source: "service/inference",
        dedupeId: randomUUID(),
        traceId: payload.traceId,
        payload: resultEvent,
      };

      await bus.publish(subjects.completed, envelope);

      app.log.info(
        safeLogAttributes({
          event: "inference_nats_completed",
          requestId: resultEvent.requestId,
          orgId: resultEvent.orgId,
          riskBand: resultEvent.riskBand,
          score: resultEvent.score,
        }),
      );
    } catch (error) {
      const duration = calculateDurationSeconds(start);
      recordInferenceError("nats", app.inferenceEngine.version, "execution_error");
      observeInference("nats", app.inferenceEngine.version, "error", duration);
      app.log.error({ err: safeLogError(error) }, "inference_nats_failed");
    }
  });

  app.addHook("onClose", async () => {
    await unsubscribe();
    await bus.close();
  });
}

function calculateDurationSeconds(start: bigint): number {
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1_000_000_000;
}

function validateRequestEnvelope(payload: InferenceRequestedEvent): void {
  if (typeof payload.requestId !== "string" || payload.requestId.trim().length === 0) {
    throw new Error("requestId missing");
  }
  if (typeof payload.orgId !== "string" || payload.orgId.trim().length === 0) {
    throw new Error("orgId missing");
  }
  validateFeatures(payload.features);
}
