import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { EventBus } from "@apgms/shared";

import type { LoadedModel } from "../model/model-loader.js";
import type { AppConfig } from "../config.js";
import { anomalyGauge, inferenceCounter, inferenceDuration } from "../plugins/metrics.js";

interface InferenceRequestBody {
  orgId: string;
  key: string;
  traceId?: string;
  payload: Record<string, number> & {
    amount: number;
    velocity: number;
    accountAgeDays: number;
    chargebackRate: number;
  };
}

interface InferenceResponse {
  id: string;
  score: number;
  anomaly: boolean;
  threshold: number;
  modelVersion: string;
}

interface ErrorResponse {
  message: string;
}

export function registerInferenceRoute(
  app: FastifyInstance,
  model: LoadedModel,
  config: AppConfig,
  bus: EventBus,
): void {
  app.post<{ Body: InferenceRequestBody; Reply: InferenceResponse | ErrorResponse }>(
    "/v1/anomaly-score",
    async (request, reply) => {
      const endTimer = inferenceDuration.startTimer();
      const envelopeId = randomUUID();

      try {
        const score = model.score(request.body.payload);
        const anomaly = model.isAnomalous(score);
        const outcomeLabel = anomaly ? "anomaly" : "normal";
        inferenceCounter.inc({ outcome: outcomeLabel });
        anomalyGauge.set(anomaly ? 1 : 0);
        endTimer({ outcome: outcomeLabel });

        if (anomaly) {
          await bus.publish(config.anomalySubject, {
            id: envelopeId,
            orgId: request.body.orgId,
            eventType: "ml.anomaly",
            key: request.body.key,
            ts: new Date().toISOString(),
            schemaVersion: config.schemaVersion,
            source: config.serviceName,
            dedupeId: envelopeId,
            traceId: request.body.traceId,
            payload: {
              ...request.body.payload,
              score,
              threshold: model.definition.threshold,
              modelVersion: model.definition.version,
            },
          });
        }

        const response: InferenceResponse = {
          id: envelopeId,
          score,
          anomaly,
          threshold: model.definition.threshold,
          modelVersion: model.definition.version,
        };

        return reply.code(200).send(response);
      } catch (error) {
        endTimer({ outcome: "error" });
        inferenceCounter.inc({ outcome: "error" });
        anomalyGauge.set(0);
        app.log.error({ err: error }, "Failed to perform inference");
        return reply.status(400).send({ message: (error as Error).message });
      }
    },
  );
}
