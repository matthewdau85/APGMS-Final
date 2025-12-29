import type { FastifyReply, FastifyRequest } from "fastify";
import { getServiceMode } from "../service-mode.js";

export async function enforceNotSuspended(
  _req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const mode = getServiceMode();
  if (mode.mode === "suspended") {
    reply.code(503).send({
      error: "SERVICE_SUSPENDED",
      message: "Service is temporarily suspended.",
      mode,
    });
  }
}

export async function enforceNotReadOnly(
  _req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const mode = getServiceMode();
  if (mode.mode === "read-only") {
    reply.code(503).send({
      error: "SERVICE_READ_ONLY",
      message: "Service is in read-only mode.",
      mode,
    });
  }
}
