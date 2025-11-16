import { type FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { parseWithSchema } from "../lib/validation.js";
import { readTierTuningConfig, writeTierTuningConfig } from "../lib/tier-config.js";

const scheduleSchema = z.object({
  defaultFrequencyHours: z.number().min(1).max(168).optional(),
  orgOverrides: z.record(z.string(), z.number().min(1).max(168)).optional(),
});

const tierTuningSchema = z.object({
  marginPercent: z.number().min(0).max(0.5).optional(),
  schedule: scheduleSchema.optional(),
});

export const registerTierAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/tier-tuning", async () => ({ config: readTierTuningConfig() }));

  app.post("/admin/tier-tuning", async (req, reply) => {
    const payload = parseWithSchema(req.body ?? {}, tierTuningSchema);
    const config = writeTierTuningConfig(payload);
    reply.send({ status: "updated", config });
  });
};

export default registerTierAdminRoutes;
