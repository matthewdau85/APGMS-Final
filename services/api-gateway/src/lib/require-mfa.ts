import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireMfa(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return;
  }

  if (!req.user?.mfaCompleted) {
    reply.code(403).send({ ok: false, error: "mfa_required" });
    return;
  }
}
