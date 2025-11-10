import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { observeInference } from "../metrics.js";

const inferenceObservationSchema = z.object({
  modelVersion: z.string().min(1, "modelVersion is required"),
  durationMs: z.number().positive("durationMs must be positive"),
  outcome: z.enum(["success", "error"]),
  errorBudgetRemaining: z.number().min(0).max(1).optional(),
  driftScores: z
    .record(z.string(), z.number().min(0).max(1))
    .optional(),
});

export async function registerInferenceRoutes(app: FastifyInstance) {
  app.post("/inference/observations", async (request, reply) => {
    const payload = inferenceObservationSchema.parse(request.body);

    observeInference(payload);

    reply.code(202).send({ status: "accepted" });
  });
}
