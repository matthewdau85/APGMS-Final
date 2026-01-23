// services/api-gateway/src/routes/metrics.ts
import type { FastifyPluginAsync } from "fastify";
import client from "prom-client";

let metricsInitialized = false;

function ensureMetricsInitialized(): void {
  if (metricsInitialized) return;
  metricsInitialized = true;

  // Default process metrics (cpu/mem/eventloop/etc)
  client.collectDefaultMetrics({
    // Use the default registry; avoid custom prefixes unless needed.
  });
}

export const registerMetricsRoutes: FastifyPluginAsync = async (app) => {
  ensureMetricsInitialized();

  app.get(
    "/metrics",
    {
      config: {
        // keep explicit; some codebases use this for gating/ACL elsewhere
        isPublic: true,
      },
    },
    async (_req, reply) => {
      try {
        const body = await client.register.metrics();
        reply.header("content-type", client.register.contentType);
        return reply.status(200).send(body);
      } catch (err) {
        app.log.error({ err }, "metrics: failed to render");
        return reply.status(500).send({ error: "metrics_failed" });
      }
    }
  );
};
