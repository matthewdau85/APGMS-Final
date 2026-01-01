import type { FastifyPluginAsync } from "fastify";

const routes: FastifyPluginAsync = async (app) => {
  app.get("/compliance/summary", async (req, reply) => {
    const q = (req.query ?? {}) as Record<string, unknown>;
    const period = (q.period ?? "").toString();

    if (!period) {
      return reply.code(400).send({
        ok: false,
        error: "Missing required query param: period",
      });
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
