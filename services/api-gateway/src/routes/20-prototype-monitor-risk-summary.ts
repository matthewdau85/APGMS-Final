import type { FastifyInstance } from "fastify";

function normEnv(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function isProd(app: any): boolean {
  const cfg = app?.config ?? {};
  const env = normEnv(cfg.environment || process.env.NODE_ENV || "development");
  return env === "production";
}

function isAdmin(req: any): boolean {
  return (
    req?.user?.isAdmin === true ||
    req?.user?.role === "admin" ||
    req?.user?.scopes?.includes?.("admin") === true ||
    req?.headers?.["x-admin"] === "true" ||
    req?.headers?.["x-user-role"] === "admin"
  );
}

export default async function prototypeRiskSummary(app: FastifyInstance): Promise<void> {
  app.get("/monitor/risk/summary", async (req, reply) => {
    if (isProd(app as any)) {
      reply.code(404).send({ error: "not_found" });
      return;
    }

    if (!isAdmin(req as any)) {
      reply.code(403).send({ error: "admin_only_prototype" });
      return;
    }

    reply.code(200).send({ ok: true, risk: "LOW" });
  });
}
