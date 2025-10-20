import { FastifyInstance } from "fastify";

export default async function taxRoutes(app: FastifyInstance) {
  const base = process.env.TAX_ENGINE_URL ?? "http://tax-engine:8000";

  app.get("/tax/health", async (_req, reply) => {
    try {
      const res = await fetch(`${base}/health`);
      if (!res.ok) {
        throw new Error(`tax-engine responded with ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      app.log.error(e);
      reply.code(502);
      return { ok: false, error: "tax-engine unavailable" };
    }
  });
}

