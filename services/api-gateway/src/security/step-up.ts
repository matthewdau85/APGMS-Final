import type { FastifyReply, FastifyRequest } from "fastify";
import { requireRecentVerification } from "./mfa.js";

export function enforceAdminStepUp(
  request: FastifyRequest,
  reply: FastifyReply,
  action: string,
): boolean {
  const user =
    (request as any).user as { id?: string; sub?: string; mfaEnabled?: boolean } | undefined;
  const userId = user?.id ?? user?.sub;

  if (!userId) {
    reply.code(401).send({ error: { code: "unauthorized", message: "User context missing" } });
    return false;
  }

  if (!user.mfaEnabled) {
    reply.code(403).send({
      error: {
        code: "mfa_not_enrolled",
        message: "MFA enrollment is required for administrative actions",
      },
    });
    return false;
  }

  if (!requireRecentVerification(userId)) {
    reply.code(428).send({
      error: {
        code: "mfa_step_up_required",
        message: `Recent MFA verification required before performing ${action}`,
        action,
      },
    });
    return false;
  }

  return true;
}
