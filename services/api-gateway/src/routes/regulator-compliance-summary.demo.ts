import type { FastifyPluginAsync } from "fastify";

const routes: FastifyPluginAsync = async (app) => {
  app.get("/compliance/summary", async (req: any) => {
    const period = (req.query?.period ?? "").toString();
    if (!period) {
      return { ok: false, error: "missing_period" };
    }

    const orgId = (req.headers["x-org-id"] ?? "").toString() || null;

    return {
      ok: true,
      orgId,
      period,
      summary: {
        status: "demo",
        notes: "Demo compliance summary stub. Replace with real aggregation.",
      },
    };
  });
};

export default routes;
