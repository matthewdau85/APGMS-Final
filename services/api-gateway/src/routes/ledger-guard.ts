import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthenticatedUser } from "../auth.js";

export type LedgerPrincipal = AuthenticatedUser;

export function requireLedgerUser(
  request: FastifyRequest,
  reply: FastifyReply
): LedgerPrincipal | null {
  const user = (request as FastifyRequest & { user?: AuthenticatedUser }).user;

  if (!user) {
    reply.code(401).send({
      error: {
        code: "unauthorized",
        message: "Authentication required"
      }
    });
    return null;
  }

  return user;
}

export type LedgerGuard = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: unknown) => void
) => void;

export function createLedgerGuard(): LedgerGuard {
  return (request, reply, done) => {
    const user = requireLedgerUser(request, reply);
    if (!user) {
      return;
    }
    done();
  };
}
