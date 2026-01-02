import type { FastifyPluginAsync } from "fastify";

const routes: FastifyPluginAsync = async (app) => {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@apgms.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin";

  app.post("/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; password?: string };
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();

    if (email !== adminEmail.toLowerCase() || password !== adminPassword) {
      reply.code(401).send({ ok: false, error: "invalid_credentials" });
      return;
    }

    const token = app.jwt.sign({ email, role: "admin" });

    reply.setCookie("apgms_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });

    return { ok: true, user: { email, role: "admin" as const } };
  });

  app.get("/auth/me", async (req, reply) => {
    try {
      await req.jwtVerify();
      return { ok: true, user: req.user };
    } catch {
      reply.code(401).send({ ok: false, user: null });
    }
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie("apgms_session", { path: "/" });
    return { ok: true };
  });
};

export default routes;
