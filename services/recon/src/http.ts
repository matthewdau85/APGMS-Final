import Fastify, { type FastifyInstance } from "fastify";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { z } from "zod";

import { config } from "./config.js";
import { registry } from "./metrics.js";
import { ReconciliationService } from "./service.js";

const tracer = trace.getTracer("services.recon.http");

const InferenceRequestSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  artifactId: z.string().min(1).optional(),
});

type InferenceRequestBody = z.infer<typeof InferenceRequestSchema>;

export function createHttpServer(service: ReconciliationService): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get("/healthz", async () => ({ status: "ok", service: config.serviceName }));

  app.post<{ Body: InferenceRequestBody }>("/v1/inference", async (request, reply) => {
    const span = tracer.startSpan("http.runInference");

    try {
      const payload = InferenceRequestSchema.parse(request.body);
      span.setAttribute("recon.orgId", payload.orgId);
      if (payload.artifactId) {
        span.setAttribute("recon.artifactId", payload.artifactId);
      }

      const result = await service.runInference(payload.orgId, payload.artifactId, "http");
      span.setStatus({ code: SpanStatusCode.OK });
      return reply.code(200).send(result);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      span.recordException(error as Error);

      request.log.error({ err: error }, "inference_failed");
      const statusCode = error instanceof z.ZodError ? 400 : 500;
      return reply.code(statusCode).send({
        error: statusCode === 400 ? "validation_error" : "inference_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      span.end();
    }
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", registry.contentType);
    return reply.send(await registry.metrics());
  });

  return app;
}
