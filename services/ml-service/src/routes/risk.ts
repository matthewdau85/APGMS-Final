import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { inferenceDuration } from "../lib/metrics.js";
import { requireModel } from "../lib/modelRegistry.js";
import { buildExplanations, scoreModel } from "../lib/scoring.js";
import { observeDrift } from "../lib/drift.js";

const shortfallSchema = z.object({
  liquidityRatio: z.number().min(0),
  burnRate: z.number().min(0),
  variance: z.number().min(0),
  entityType: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const fraudSchema = z.object({
  amount: z.number().min(0),
  velocity: z.number().min(0),
  geoRisk: z.number().min(0),
  channel: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

type RiskResponse = {
  model: {
    name: string;
    version: string;
    threshold: number;
  };
  score: number;
  recommendation: "allow" | "review";
  contributions: ReturnType<typeof scoreModel>["contributions"];
  explanations: ReturnType<typeof buildExplanations>;
  drift: {
    flagged: boolean;
    deltas: Array<{ feature: string; delta: number }>;
    tolerance: number;
  };
};

async function runRiskEvaluation(
  modelKey: string,
  payload: Record<string, number>
): Promise<RiskResponse> {
  const model = await requireModel(modelKey);
  const timerEnd = inferenceDuration.startTimer({ model: model.name });
  const { score, contributions } = scoreModel(model, payload);
  timerEnd();

  const drift = observeDrift(model, payload);
  const flagged = drift.some((entry) => Math.abs(entry.delta) > model.driftTolerance);

  return {
    model: { name: model.name, version: model.version, threshold: model.threshold },
    score,
    recommendation: score >= model.threshold ? "review" : "allow",
    contributions,
    explanations: buildExplanations(model, payload),
    drift: {
      flagged,
      deltas: drift,
      tolerance: model.driftTolerance
    }
  };
}

export async function registerRiskRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: z.infer<typeof shortfallSchema> }>("/risk/shortfall", async (request, reply) => {
    const parsed = shortfallSchema.parse(request.body);
    const features = {
      liquidityRatio: parsed.liquidityRatio,
      burnRate: parsed.burnRate,
      variance: parsed.variance
    };
    const response = await runRiskEvaluation("bas_shortfall", features);
    reply.send(response);
  });

  app.post<{ Body: z.infer<typeof fraudSchema> }>("/risk/fraud", async (request, reply) => {
    const parsed = fraudSchema.parse(request.body);
    const features = {
      amount: parsed.amount,
      velocity: parsed.velocity,
      geoRisk: parsed.geoRisk
    };
    const response = await runRiskEvaluation("fraud_review", features);
    reply.send(response);
  });
}
