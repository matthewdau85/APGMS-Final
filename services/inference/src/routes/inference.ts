import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { observeInference, recordInferenceError } from "../observability/metrics.js";
import { parseRequestBody, ValidationError } from "../validation.js";
import type { InferenceRequestBody, InferenceResult } from "@apgms/shared";
import { safeLogAttributes, safeLogError } from "@apgms/shared";

export async function registerInferenceRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: InferenceRequestBody;
    Reply: { result: InferenceResult } | { error: { code: string; message: string } };
  }>("/inference/score", async (request, reply) => {
    let parsed: InferenceRequestBody;
    const start = process.hrtime.bigint();

    try {
      parsed = parseRequestBody(request.body);
    } catch (error) {
      const duration = calculateDurationSeconds(start);
      observeInference("http", app.inferenceEngine.version, "error", duration);
      const message = error instanceof ValidationError ? error.message : "Invalid request";
      reply.code(400).send({ error: { code: "invalid_request", message } });
      return;
    }

    const timerStart = process.hrtime.bigint();
    try {
      const scored = app.inferenceEngine.score(parsed.features);
      const duration = calculateDurationSeconds(timerStart);
      observeInference("http", app.inferenceEngine.version, "success", duration);

      const result: InferenceResult = {
        ...scored,
        requestId: parsed.requestId,
      };

      const thresholdBreached = result.score >= config.threshold;
      request.log.info(
        safeLogAttributes({
          event: "inference_http_completed",
          requestId: result.requestId,
          orgId: parsed.orgId,
          riskBand: result.riskBand,
          score: result.score,
          thresholdBreached,
        }),
      );

      reply.send({ result });
    } catch (error) {
      const duration = calculateDurationSeconds(timerStart);
      recordInferenceError("http", app.inferenceEngine.version, "execution_error");
      observeInference("http", app.inferenceEngine.version, "error", duration);
      request.log.error({ err: safeLogError(error) }, "inference_http_failed");
      reply.code(500).send({ error: { code: "inference_failed", message: "Inference execution failed" } });
    }
  });
}

function calculateDurationSeconds(start: bigint): number {
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1_000_000_000;
}
