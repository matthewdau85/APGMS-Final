import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { context, trace } from "@opentelemetry/api";
import { authenticateRequest, type Role } from "../lib/auth.js";
import { publishComplianceEvent } from "../lib/compliance-events.js";

export async function registerTaxRoutes(app: FastifyInstance) {
  const guard = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) =>
      authenticateRequest(app, req, reply, roles);

  app.get("/tax/health", { preHandler: guard([]) }, async (req, reply) => {
    const span = trace.getTracer("api").startSpan("tax.health");
    const ctx = trace.setSpan(context.active(), span);
    try {
      const upstream = String((app as any).config?.taxEngineUrl ?? "");
      if (!upstream) {
        reply.send({ ok: true, upstream: null });
        return;
      }
      const res = await fetch(`${upstream}/health`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) {
        const orgId = (req as any).user?.orgId as string | undefined;
        if (orgId) {
          await publishComplianceEvent(app, {
            kind: "DISCREPANCY",
            orgId,
            category: "tax.healthcheck.failure",
            severity: "MEDIUM",
            description: "Upstream tax engine health check failed",
            metadata: { status: res.status, upstream },
            request: req,
            source: "api-gateway.tax",
          });
        }
      }
      reply.send({ ok: res.ok, upstream });
    } catch (err) {
      app.metrics?.recordSecurityEvent?.("tax.health.error");
      const orgId = (req as any).user?.orgId as string | undefined;
      if (orgId) {
        await publishComplianceEvent(app, {
          kind: "DISCREPANCY",
          orgId,
          category: "tax.healthcheck.error",
          severity: "HIGH",
          description: "Tax engine health request threw an exception",
          metadata: { error: (err as Error).message },
          request: req,
          source: "api-gateway.tax",
        });
      }
      reply.code(502).send({ ok: false });
    } finally {
      span.end();
    }
  });
}
