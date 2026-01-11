import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Role, type SessionRole, type SessionUser } from "../auth.js";

type LoginBody = {
  email: string;
  role?: SessionRole;
  sub?: string;
  mfaCompleted?: boolean;
  orgId?: string;
};

function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
  };
}

function isDevAuthEnabled() {
  return String(process.env.ENABLE_DEV_AUTH ?? "").toLowerCase() === "true";
}

function isAllowedRole(role: string): role is SessionRole {
  return Object.values(Role).includes(role as SessionRole);
}

export default async function authRoutes(app: FastifyInstance) {
  // Current session
  app.get(
    "/auth/me",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
        return reply.send({ ok: true, user: req.user });
      } catch {
        return reply.code(401).send({ ok: false, error: "unauthorized" });
      }
    }
  );

  // Dev/demo login (cookie-backed JWT)
  app.post(
    "/auth/login",
    async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      if (process.env.NODE_ENV === "production") {
        return reply.code(404).send({ ok: false, error: "not_found" });
      }

      if (!isDevAuthEnabled()) {
        return reply.code(404).send({ ok: false, error: "not_found" });
      }

      const body = req.body;

      if (!body?.email || typeof body.email !== "string") {
        return reply
          .code(400)
          .send({ ok: false, error: "email_required" });
      }

      const email = body.email.trim().toLowerCase();
      if (!email) {
        return reply
          .code(400)
          .send({ ok: false, error: "email_required" });
      }

      const requestedRole = typeof body.role === "string" ? body.role : "";
      const role: SessionRole = isAllowedRole(requestedRole) ? requestedRole : "user";
      const sub = (body.sub && body.sub.trim()) || email;
      const orgId =
        typeof body.orgId === "string" && body.orgId.trim().length > 0
          ? body.orgId.trim()
          : undefined;

      // Dev/demo default: MFA satisfied unless explicitly set false
      const mfaCompleted =
        typeof body.mfaCompleted === "boolean" ? body.mfaCompleted : true;

      const user: SessionUser = { sub, email, role, mfaCompleted, orgId };

      const token = await reply.jwtSign(user);

      reply.setCookie("apgms_session", token, cookieOpts());
      return reply.send({ ok: true, user });
    }
  );

  // Logout (clear cookie)
  app.post(
    "/auth/logout",
    async (_req: FastifyRequest, reply: FastifyReply) => {
      reply.clearCookie("apgms_session", { path: "/" });
      return reply.send({ ok: true });
    }
  );
}
