import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { context, trace } from "@opentelemetry/api";
import { authenticateRequest, type Role } from "../lib/auth.js";

export async function registerTaxRoutes(app: FastifyInstance) {
  const guard = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) =>
      authenticateRequest(app, req, reply, roles);

  app.get("/tax/health", { preHandler: guard([]) }, async (_req, reply) => {
    const span = trace.getTracer("api").startSpan("tax.health");
    const ctx = trace.setSpan(context.active(), span);
    try {
      const upstream = String((app as any).config?.taxEngineUrl ?? "");
      if (!upstream) {
        reply.send({ ok: true, upstream: null });
        return;
      }
      const res = await fetch(`${upstream}/health`, { signal: AbortSignal.timeout(2000) });
      reply.send({ ok: res.ok, upstream });
    } catch (err) {
      app.metrics?.recordSecurityEvent?.("tax.health.error");
      reply.code(502).send({ ok: false });
    } finally {
      span.end();
    }
  });
}
