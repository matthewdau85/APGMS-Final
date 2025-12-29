import type { FastifyRequest } from "fastify";

export function requireMfa(req: FastifyRequest) {
  const user = req.user;
  if (!user || !user.mfaCompleted) {
  throw new Error("MFA required");
}
}
