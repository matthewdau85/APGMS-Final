import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";

export type SessionUser = {
  email: string;
  role: "admin";
};

declare module "@fastify/jwt" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyJWT {
    payload: SessionUser;
    user: SessionUser;
  }
}

export async function registerAuth(app: FastifyInstance) {
  const secret =
    process.env.AUTH_DEV_SECRET ??
    process.env.JWT_SECRET ??
    "dev-secret-change-me";

  await app.register(cookie, { hook: "onRequest" });

  await app.register(jwt, {
    secret,
    cookie: { cookieName: "apgms_session", signed: false },
    sign: { expiresIn: "8h" },
  });
}

export async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return;
  }

  if (!req.user || req.user.role !== "admin") {
    reply.code(403).send({ ok: false, error: "forbidden" });
  }
}
