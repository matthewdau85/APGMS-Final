import Fastify from "fastify";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import { registry } from "./lib/metrics.js";
import { registerRiskRoutes } from "./routes/risk.js";
import { registerPlanRoutes } from "./routes/plan.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors as any, { origin: true });

  await registerRiskRoutes(app);
  await registerPlanRoutes(app);

  app.get("/health", async () => ({ ok: true, service: "ml-service" }));

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4006);
  const host = process.env.HOST ?? "0.0.0.0";

  buildServer()
    .then((app) => app.listen({ port, host }))
    .catch((error) => {
      console.error("Failed to start ml-service", error);
      process.exitCode = 1;
    });
}
