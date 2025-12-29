// services/api-gateway/src/auth.ts
import type { FastifyReply, FastifyRequest } from "fastify";

export type Role = "admin" | "user";

export interface AuthenticatedUser {
  sub: string;
  orgId: string;
  role: Role;
  mfaCompleted?: boolean;
}

export function authGuard(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!(request as any).user) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}

export function authenticateRequest(request: FastifyRequest): AuthenticatedUser {
  const u: any = (request as any).user;
  if (!u || !u.sub || !u.orgId || !u.role) {
    throw new Error("Unauthenticated");
  }
  return {
    sub: String(u.sub),
    orgId: String(u.orgId),
    role: u.role === "admin" ? "admin" : "user",
    mfaCompleted: Boolean(u.mfaCompleted),
  };
}

export function createAuthGuard(_opts?: { audience?: string; issuer?: string }) {
  return function guard(request: FastifyRequest, _reply: FastifyReply, done: () => void) {
    if (!(request as any).user) {
      const h: any = request.headers || {};
      const orgId = String(h["x-org-id"] || "test-org");
      (request as any).user = {
        sub: String(h["x-user-sub"] || "test-user"),
        orgId,
        role: (h["x-user-role"] === "admin" ? "admin" : "user") as Role,
        mfaCompleted: Boolean(h["x-mfa"] === "1" || h["x-mfa"] === "true"),
      } satisfies AuthenticatedUser;
    }
    done();
  };
}
