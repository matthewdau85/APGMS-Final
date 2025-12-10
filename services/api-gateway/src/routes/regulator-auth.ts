// services/api-gateway/src/routes/regulator-auth.ts

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyPluginAsync,
} from "fastify";

import { createRegulatorSession } from "../lib/regulator-session.js";

// Plugin: handles regulator session creation
export const registerRegulatorAuthRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  // POST /regulator/session
  app.post(
    "/session",
    {},
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await createRegulatorSession(request);

        reply.code(200).send({
          ok: true,
          session: result.session,
          sessionToken: result.sessionToken,
        });
      } catch (_err) {
        reply.code(401).send({
          error: {
            code: "unauthorized",
            message: "Missing regulator identity",
          },
        });
      }
    },
  );
};
