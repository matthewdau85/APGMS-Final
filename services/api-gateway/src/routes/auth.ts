import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { SessionRole, SessionUser } from "../auth.js";

type LoginBody = {
  email: string;
  role?: SessionRole;
  sub?: string;
  mfaCompleted?: boolean;
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

      const role: SessionRole = body.role ?? "admin";
      const sub = (body.sub && body.sub.trim()) || email;

      // Dev/demo default: MFA satisfied unless explicitly set false
      const mfaCompleted =
        typeof body.mfaCompleted === "boolean" ? body.mfaCompleted : true;

      const user: SessionUser = { sub, email, role, mfaCompleted };

      const token = await reply.jwtSign(user);
        reply.setCookie("apgms_session", token, cookieOpts());

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
