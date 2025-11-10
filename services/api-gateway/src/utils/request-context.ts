import type { FastifyRequest } from "fastify";

export const extractTraceId = (request: FastifyRequest): string | undefined => {
  try {
    const bindings = typeof (request.log as any)?.bindings === "function"
      ? (request.log as any).bindings()
      : undefined;
    const traceId = bindings?.traceId;
    return typeof traceId === "string" ? traceId : undefined;
  } catch {
    return undefined;
  }
};
