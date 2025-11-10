import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerFeedbackRoutes } from "./routes/feedback.js";
import { registerMetricsRoute } from "./routes/metrics.js";
import { registerInferenceRoutes } from "./routes/inference.js";

const buildServer = () => {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, { origin: true });
  app.register(registerFeedbackRoutes);
  app.register(registerInferenceRoutes);
  app.register(registerMetricsRoute);

  return app;
};

const start = async () => {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 4005);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
    app.log.info({ port, host }, "ml-service started");
  } catch (error) {
    app.log.error(error, "Failed to start ml-service");
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  start();
}

export type MlService = ReturnType<typeof buildServer>;
export { buildServer };
