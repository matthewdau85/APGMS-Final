import { FastifyInstance } from "fastify";
import { z } from "zod";

import { errorSchema } from "../schemas/common";

const taxEngineHealthSchema = z
  .object({
    ok: z.boolean(),
    version: z.string().optional(),
  })
  .passthrough();

export default async function taxRoutes(app: FastifyInstance) {
  const base = process.env.TAX_ENGINE_URL ?? "http://tax-engine:8000";

  app.get("/tax/health", async (_req, reply) => {
    try {
      const res = await fetch(`${base}/health`);
      if (!res.ok) {
        throw new Error(`tax-engine responded with ${res.status}`);
      }
      const data = await res.json();
      const parsed = taxEngineHealthSchema.parse(data);
      return parsed;
    } catch (error) {
      app.log.error({ err: error }, "tax_engine_health_error");
      return reply.code(502).send(errorSchema.parse({ error: "Bad Gateway" }));
    }
  });
}
