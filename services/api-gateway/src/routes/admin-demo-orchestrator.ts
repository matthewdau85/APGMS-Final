// ASCII only
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../security/requireAdmin.js";
import { runAdminJob } from "../admin/admin-jobs.js";
import type { DemoStressParams } from "../admin/demo-stress.js";

const DemoStressSchema = z.object({
  durationSeconds: z.number().int().min(5).max(300).optional(),
  concurrency: z.number().int().min(1).max(100).optional(),
  paths: z.array(z.string()).min(1).max(20).optional(),
});

export async function registerAdminDemoOrchestratorRoutes(app: FastifyInstance) {
  app.post("/admin/demo/stress", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = DemoStressSchema.safeParse((req as any).body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: { code: "invalid_request" } });
      return;
    }

    const params: DemoStressParams = parsed.data;
    const result = await runAdminJob({ type: "demo-stress", params });
    return reply.send({ ok: true, result });
  });
}
