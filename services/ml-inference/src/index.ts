import Fastify from "fastify";
import type { EventBus } from "@apgms/shared";

import { loadConfig } from "./config.js";
import { buildEventBus } from "./event-bus.js";
import { registerMetrics } from "./plugins/metrics.js";
import { loadModel } from "./model/model-loader.js";
import { registerInferenceRoute } from "./routes/inference.js";

async function bootstrap() {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
  });

  await registerMetrics(app);

  app.get("/healthz", async () => ({ status: "ok" }));

  const model = await loadModel(config.modelPath);
  app.log.info({ version: model.definition.version, threshold: model.definition.threshold }, "Model loaded");

  const bus: EventBus = await buildEventBus(config.eventBus);
  app.addHook("onClose", async () => {
    if ("close" in bus && typeof (bus as { close?: () => Promise<void> }).close === "function") {
      await (bus as { close: () => Promise<void> }).close();
    }
  });

  registerInferenceRoute(app, model, config, bus);

  await app.listen({ port: config.port, host: config.host });
  app.log.info({ port: config.port, host: config.host }, "ML inference service ready");
}

void bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap ML inference service", error);
  process.exitCode = 1;
});
