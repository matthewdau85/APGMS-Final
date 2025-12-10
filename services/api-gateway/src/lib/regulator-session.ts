// services/api-gateway/src/lib/regulator-session.ts

import type { FastifyReply, FastifyRequest } from "fastify";

// Create a session and RETURN it instead of replying here.
export async function createRegulatorSession(
  request: FastifyRequest,
): Promise<{
  session: { id: string; userId: string };
  sessionToken: string;
}> {
  const userId = request.headers["x-reg-user-id"];
  if (!userId || typeof userId !== "string") {
    throw new Error("unauthorized_regulator");
  }

  return {
    session: {
      id: "session-stub",
      userId: userId,
    },
    sessionToken: `stub-token-${userId}`,
  };
}

// Middleware guard — still sends replies directly
export async function ensureRegulatorSessionActive(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const sessionId = request.headers["x-reg-session-id"];
  if (!sessionId || typeof sessionId !== "string") {
    reply.code(401).send({
      error: {
        code: "no_regulator_session",
        message: "Missing or invalid regulator session",
      },
    });
  }
}
