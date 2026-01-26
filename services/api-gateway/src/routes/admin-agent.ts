import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../security/requireAdmin.js";

type RunRecord = {
  id: string;
  type: string;
  startedAt: string;
  params?: unknown;
};

const runs: RunRecord[] = [];

export function registerAdminAgentRoutes(app: FastifyInstance) {
  app.get("/admin/agent/runs", { preHandler: requireAdmin }, async () => {
    return { ok: true, runs };
  });

  app.post("/admin/agent/run", { preHandler: requireAdmin }, async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rec: RunRecord = {
      id: `run_${Date.now()}`,
      type: String(body.type ?? "unknown"),
      startedAt: new Date().toISOString(),
      params: body.params ?? null,
    };
    runs.unshift(rec);
    return { ok: true, run: rec };
  });
}
