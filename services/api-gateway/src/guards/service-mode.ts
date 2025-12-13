import type { FastifyReply, FastifyRequest } from "fastify";
import { getServiceMode } from "../service-mode.js";

function sendSuspended(reply: FastifyReply) {
  const s = getServiceMode();
  return reply
    .code(503)
    .header("x-service-mode", s.mode)
    .send({
      error: "SERVICE_SUSPENDED",
      message: "Service is currently suspended.",
      serviceMode: s,
    });
}

function sendReadOnlyBlocked(reply: FastifyReply) {
  const s = getServiceMode();
  return reply
    .code(409)
    .header("x-service-mode", s.mode)
    .send({
      error: "READ_ONLY_MODE",
      message: "Service is currently in read-only mode. Writes are blocked.",
      serviceMode: s,
    });
}

// Route-level guard: attach to mutating endpoints.
export function requireWritesEnabled(): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (_req, reply) => {
    const { mode } = getServiceMode();

    if (mode === "normal") return;

    if (mode === "suspended") {
      sendSuspended(reply);
      return;
    }

    // read-only
    sendReadOnlyBlocked(reply);
  };
}

// Plugin-level guard: attach once; allows GET/HEAD/OPTIONS in read-only.
// In suspended mode, blocks everything in that plugin.
export function serviceModeHttpGuard(): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req, reply) => {
    const { mode } = getServiceMode();

    if (mode === "normal") return;

    if (mode === "suspended") {
      sendSuspended(reply);
      return;
    }

    // read-only: allow read methods, block writes
    const m = (req.method || "GET").toUpperCase();
    if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

    sendReadOnlyBlocked(reply);
  };
}
