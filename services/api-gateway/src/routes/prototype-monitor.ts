import type { FastifyInstance, FastifyPluginAsync } from "fastify";

function parseUserFromAuthHeader(authHeader: string | undefined) {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : "";
  if (!token) return null;

  const lower = token.toLowerCase();
  const isAdmin = lower.includes("admin");
  return { token, isAdmin };
}

export const prototypeMonitorRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const env = String((app as any).config?.environment || process.env.NODE_ENV || "development");
  const isProd = env === "production";

  app.get("/monitor/risk/summary", async (req, reply) => {
    if (isProd) {
      reply.code(404);
      return { error: "not_found" };
    }

    const user = parseUserFromAuthHeader(req.headers.authorization as any);
    if (!user) {
      reply.code(401);
      return { error: "unauthorized" };
    }

    if (!user.isAdmin) {
      reply.code(403);
      return { error: "admin_only_prototype" };
    }

    return { ok: true, risk: "LOW" };
  });
};
