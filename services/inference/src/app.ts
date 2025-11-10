import Fastify, { type FastifyInstance } from "fastify";

import { config } from "./config.js";
import { InferenceEngine } from "./model/engine.js";
import { registerMetricsRoute } from "./observability/metrics.js";
import { registerInferenceRoutes } from "./routes/inference.js";
import { initInferenceWorker } from "./nats/worker.js";
import { safeLogError } from "@apgms/shared";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  const engine = new InferenceEngine();
  app.decorate("inferenceEngine", engine);

  registerMetricsRoute(app);

  app.get("/health", async () => ({
    ok: true,
    modelVersion: engine.version,
  }));

  app.get("/ready", async (_request, reply) => {
    if (config.nats && !app.inferenceNats) {
      reply.code(503).send({ ok: false, reason: "nats_not_connected" });
      return;
    }

    try {
      // quick self-check using a zero vector
      engine.score({
        payrollVariance: 0,
        reconciliationLagDays: 0,
        transactionVolume: 0,
        alertDensity: 0,
      });
      if (app.inferenceNats) {
        await app.inferenceNats.ping();
      }
      reply.send({ ok: true, modelVersion: engine.version });
    } catch (error) {
      reply.code(503).send({ ok: false, reason: "model_unavailable", details: safeLogError(error) });
    }
  });

  await registerInferenceRoutes(app);

  if (config.nats) {
    await initInferenceWorker(app);
  }

  return app;
}

