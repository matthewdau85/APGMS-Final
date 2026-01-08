import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";

/**
 * Roles are runtime-safe via Role const.
 * Use SessionRole as the type union.
 */
export const Role = {
  admin: "admin",
  ops: "ops",
  user: "user",
  auditor: "auditor",
  regulator: "regulator",
} as const;

export type SessionRole = (typeof Role)[keyof typeof Role];

/**
 * Keep this aligned with what the API gateway actually uses.
 * Optional fields are safe even if some routes don’t need them.
 */
export type SessionUser = {
  email: string;
  role: SessionRole;
  sub?: string;
  orgId?: string;
  mfaCompleted?: boolean;
};

/**
 * IMPORTANT:
 * Only declare this module augmentation in ONE place in the repo
 * (this file), otherwise you get TS2717 duplicate declaration errors.
 */
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

  if (!req.user || req.user.role !== Role.admin) {
    reply.code(403).send({ ok: false, error: "forbidden" });
    return;
  }
}
