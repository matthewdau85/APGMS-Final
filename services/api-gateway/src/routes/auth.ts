import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const {
  AUTH_DEV_SECRET,
  AUTH_AUDIENCE,
  AUTH_ISSUER,
} = process.env;

if (!AUTH_DEV_SECRET?.trim()) {
  throw new Error("AUTH_DEV_SECRET is required");
}
if (!AUTH_AUDIENCE?.trim()) {
  throw new Error("AUTH_AUDIENCE is required");
}
if (!AUTH_ISSUER?.trim()) {
  throw new Error("AUTH_ISSUER is required");
}

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: { code: "invalid_body", message: "Invalid login payload" } });
    }

    const { email, password } = parsed.data;

    // look up user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply
        .status(401)
        .send({ error: { code: "auth_failed", message: "Invalid email or password" } });
    }

    // compare password
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return reply
        .status(401)
        .send({ error: { code: "auth_failed", message: "Invalid email or password" } });
    }

    // sign JWT
    const token = jwt.sign(
      {
        sub: user.id,
        orgId: user.orgId,
        role: "admin",
        aud: AUTH_AUDIENCE,
        iss: AUTH_ISSUER,
      },
      AUTH_DEV_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h",
      },
    );

    return reply.send({ token });
  });
}
