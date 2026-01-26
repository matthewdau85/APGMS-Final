// ASCII only
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../security/requireAdmin.js";
import { runAdminJob } from "../admin/admin-jobs.js";

const RunReqSchema = z.object({
  mode: z.enum(["once"]).default("once"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export async function registerAdminRegWatcherRoutes(app: FastifyInstance) {
  app.get("/admin/regwatcher/status", { preHandler: requireAdmin }, async (_req, reply) => {
    return reply.send({
      ok: true,
      cachePresent: false,
      cacheFile: null,
      lastRun: null,
    });
  });

  app.post("/admin/regwatcher/run", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = RunReqSchema.safeParse((req as any).body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: { code: "invalid_request" } });
      return;
    }

    const result = await runAdminJob({ type: "regwatcher:once", params: parsed.data.params ?? {} });
    return reply.send({
      ok: true,
      runId: "inline",
      result,
    });
  });
}
