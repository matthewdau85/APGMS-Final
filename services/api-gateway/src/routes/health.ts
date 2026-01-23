import type { FastifyPluginAsync } from "fastify";

const registerHealthRoutes: FastifyPluginAsync = async (app) => {
  // Simple liveness probe
  app.get("/health/live", async () => ({ ok: true }));

  // Readiness probe (allow tests/CI to force fail without needing a real DB)
  app.get("/health/ready", async (_req, reply) => {
    const shouldFail =
      process.env.APGMS_READY_FAIL === "1" ||
      process.env.APGMS_READY_FAIL === "true" ||
      process.env.APGMS_READY_FAIL === "yes";

    if (shouldFail) {
      return reply.code(503).send({ ok: false });
    }

    return reply.send({ ok: true });
  });

  // Convenience/compat endpoints
  app.get("/health", async () => ({ ok: true }));

  // Mirror /health/ready semantics and status codes for tooling that expects /ready
  app.get("/ready", async (_req, reply) => {
    const res = await (app as any).inject({ method: "GET", url: "/health/ready" });
    reply.code(res.statusCode);

    // If health/ready returns JSON, forward it; otherwise forward raw payload
    const contentType = res.headers["content-type"] ?? "";
    if (typeof contentType === "string" && contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(res.payload);
        return reply.send(parsed);
      } catch {
        // fall through
      }
    }

    return reply.send(res.payload);
  });
};

export default registerHealthRoutes;
