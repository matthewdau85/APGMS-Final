import type { FastifyRequest } from "fastify";

export function requireMfa(req: FastifyRequest) {
  const user = req.user;
  if (!user || !user.mfaVerified) {
    throw new Error("MFA_REQUIRED");
  }
}
