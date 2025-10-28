// services/api-gateway/src/routes/auth.ts
import { FastifyInstance } from "fastify";
import { verifyCredentials, signToken } from "../auth.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
    };

    if (!body?.email || !body?.password) {
      reply.code(400).send({
        error: {
          code: "invalid_body",
          message: "email and password are required",
        },
      });
      return;
    }

    const user = await verifyCredentials(body.email, body.password);

    if (!user) {
      reply.code(401).send({
        error: {
          code: "bad_credentials",
          message: "Invalid email/password",
        },
      });
      return;
    }

    const token = signToken({
      id: user.id,
      orgId: user.orgId,
      role: "admin",
    });

    reply.send({ token });
  });
}
