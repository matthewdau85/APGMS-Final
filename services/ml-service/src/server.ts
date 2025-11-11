import Fastify from "fastify";
import { z } from "zod";

import { config } from "./config.js";
import { loadModelRegistry } from "./model-loader.js";
import { evaluateScore } from "./scoring.js";
import { registry } from "./metrics.js";

const requestSchema = z.object({
  features: z.record(z.number()),
  context: z
    .object({
      orgId: z.string().min(1),
      reference: z.string().min(1).optional(),
    })
    .optional(),
});

type Scenario = "shortfall" | "fraud" | "plan";

const modelIds: Record<Scenario, string> = {
  shortfall: "risk-shortfall",
  fraud: "risk-fraud",
  plan: "plan-compliance",
};

export async function buildServer() {
  const app = Fastify({ logger: true });

  const registryData = await loadModelRegistry(
    config.manifestPath,
    config.manifestSignaturePath,
    config.publicKeyPath,
  );

  app.get("/health", async () => ({
    ok: true,
    models: Array.from(registryData.models.keys()),
    issuedAt: registryData.issuedAt,
  }));

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", registry.contentType);
    reply.send(await registry.metrics());
  });

  function scoreRoute(scenario: Scenario, path: string) {
    app.post(path, async (request, reply) => {
      const parsed = requestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
        return;
      }

      const modelId = modelIds[scenario];
      const model = registryData.models.get(modelId);
      if (!model) {
        request.log.error({ scenario }, "model_not_loaded");
        reply.code(500).send({ error: "model_missing" });
        return;
      }

      const score = evaluateScore({
        scenario,
        model,
        features: parsed.data.features,
      });

      reply.send({
        scenario,
        issuedAt: registryData.issuedAt,
        model: {
          id: score.modelId,
          version: score.modelVersion,
          threshold: score.threshold,
        },
        score: score.score,
        passed: score.passed,
        contributions: score.contributions.map((entry) => ({
          feature: entry.feature,
          value: entry.value,
          weight: entry.weight,
          impact: Number(entry.impact.toFixed(4)),
          explanation: entry.explanation,
        })),
        drift: score.drift,
      });
    });
  }

  scoreRoute("shortfall", "/risk/shortfall");
  scoreRoute("fraud", "/risk/fraud");
  scoreRoute("plan", "/plan/compliance");

  return app;
}
