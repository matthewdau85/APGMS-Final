// services/api-gateway/src/auth.ts
import type { FastifyRequest, FastifyReply } from "fastify";

export type Role = "admin" | "user";

export interface AuthenticatedUser {
  sub: string;
  orgId: string;
  role: Role;
  mfaCompleted?: boolean;
}

export function authGuard(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  if (!request.user) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}

export function authenticateRequest(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) {
    throw new Error("Unauthenticated");
  }
  return request.user;
}
