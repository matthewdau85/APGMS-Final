import { SpanStatusCode, trace } from "@opentelemetry/api";
import { FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import { maskError } from "@apgms/shared";
import { authenticateRequest, type Role } from "../lib/auth";

const tracer = trace.getTracer("apgms-api-gateway");
const TAX_HEALTH_TIMEOUT_MS = 5_000;
const TAX_ALLOWED_ROLES: ReadonlyArray<Role> = ["admin", "analyst", "finance"];

const TaxHealthResponseSchema = z
  .object({
    ok: z.boolean(),
  })
  .passthrough();

export default async function taxRoutes(app: FastifyInstance): Promise<void> {
  app.get("/tax/health", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, TAX_ALLOWED_ROLES);
    if (!principal) {
      return;
    }

    const span = tracer.startSpan("tax.health.fetch");
    span.setAttribute("upstream.url", app.config.taxEngineUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TAX_HEALTH_TIMEOUT_MS);

    try {
      const res = await fetch(`${app.config.taxEngineUrl}/health`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `upstream responded with ${res.status}`,
        });
        app.metrics?.recordSecurityEvent("tax.health.upstream_fail");
        return sendUpstreamError(reply, "tax-engine unavailable", res.status);
      }

      const json = await res.json();
      const parsed = TaxHealthResponseSchema.safeParse(json);
      if (!parsed.success) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "invalid upstream payload",
        });
        app.log.warn(
          { err: parsed.error.flatten(), upstream: maskError(json) },
          "invalid tax-engine payload",
        );
        return sendUpstreamError(reply, "tax-engine payload invalid", 502);
      }

      return reply.send(parsed.data);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: "tax health check failed" });
      app.log.error({ err: maskError(error) }, "tax health request failed");
      app.metrics?.recordSecurityEvent("tax.health.error");
      return sendUpstreamError(reply, "tax-engine unavailable", 502);
    } finally {
      clearTimeout(timeout);
      span.end();
    }
  });
}

function sendUpstreamError(reply: FastifyReply, message: string, status: number) {
  const payload = {
    error: {
      code: "tax_upstream_unavailable",
      message,
    },
  };
  return reply.code(status).send(payload);
}
